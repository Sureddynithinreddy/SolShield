/**
 * Page-world script. Runs in the dApp's JS context so it can wrap the wallet
 * provider. It intercepts signing calls, holds them, asks the content script
 * (via window.postMessage) to scan, renders the SolShield overlay, and only
 * forwards the original call to the real wallet if the user allows it.
 *
 * SolShield never sees private keys — it only inspects the unsigned transaction.
 */
import type { ContentMessage, ScanRequestMsg, ScanVerdict } from "./protocol";
import { renderOverlay } from "./overlay";

type AnyFn = (...args: unknown[]) => unknown;

const pending = new Map<
  string,
  { resolveDecision: (d: "allow" | "block") => void; setVerdict: (v: ScanVerdict) => void }
>();

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Best-effort base64 encoding of a transaction-like object. */
function toBase64(tx: unknown): string {
  try {
    // web3.js Transaction / VersionedTransaction expose serialize().
    const anyTx = tx as { serialize?: (opts?: unknown) => Uint8Array };
    if (typeof anyTx?.serialize === "function") {
      let bytes: Uint8Array;
      try {
        bytes = anyTx.serialize({ requireAllSignatures: false, verifySignatures: false });
      } catch {
        bytes = anyTx.serialize();
      }
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin);
    }
  } catch {
    /* fall through */
  }
  if (tx instanceof Uint8Array) {
    let bin = "";
    for (const b of tx) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return "";
}

/** Ask the content script to scan; resolves when the user decides. */
function requestScanAndDecision(
  method: ScanRequestMsg["method"],
  payload: string
): Promise<"allow" | "block"> {
  return new Promise((resolve) => {
    const id = uid();
    const overlay = renderOverlay(id, method, (decision) => {
      window.postMessage(
        { source: "solshield-content", type: "decision", id, decision } as ContentMessage,
        "*"
      );
    });

    pending.set(id, {
      resolveDecision: (d) => {
        overlay.close();
        resolve(d);
        pending.delete(id);
      },
      setVerdict: (v) => overlay.update(v),
    });

    const msg: ScanRequestMsg = {
      source: "solshield-inject",
      type: "scan-request",
      id,
      method,
      payload,
      origin: location.hostname,
    };
    window.postMessage(msg, "*");
  });
}

// Receive verdict + final decision relay from the content script.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as ContentMessage | undefined;
  if (!data || data.source !== "solshield-content") return;
  const entry = pending.get(data.id);
  if (!entry) return;
  if (data.type === "verdict") entry.setVerdict(data.verdict);
  // The decision is driven by the overlay buttons (which postMessage a
  // "decision"); the content script echoes it back so both worlds agree.
  if (data.type === "decision") entry.resolveDecision(data.decision);
});

/** Wraps a provider's signing methods with the SolShield gate. */
function wrapProvider(provider: Record<string, unknown>): void {
  if (!provider || (provider as { __solshield?: boolean }).__solshield) return;

  const wrap = (name: ScanRequestMsg["method"]) => {
    const original = provider[name];
    if (typeof original !== "function") return;
    provider[name] = async function (this: unknown, ...args: unknown[]) {
      try {
        const payload =
          name === "signMessage"
            ? decodeMessageArg(args[0])
            : name === "signAllTransactions"
            ? JSON.stringify((args[0] as unknown[])?.map(toBase64) ?? [])
            : toBase64(args[0]);
        const decision = await requestScanAndDecision(name, payload);
        if (decision === "block") {
          throw new Error("SolShield: transaction blocked by the user.");
        }
      } catch (err) {
        // If the user blocked, reject the dApp's call (user-rejected pattern).
        if (err instanceof Error && err.message.startsWith("SolShield:")) throw err;
        // Any internal error shouldn't break the dApp — fall through to sign.
      }
      return (original as AnyFn).apply(this, args);
    };
  };

  wrap("signTransaction");
  wrap("signAllTransactions");
  wrap("signAndSendTransaction");
  wrap("signMessage");
  Object.defineProperty(provider, "__solshield", { value: true, enumerable: false });
}

function decodeMessageArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Uint8Array) {
    try {
      return new TextDecoder().decode(arg);
    } catch {
      return "";
    }
  }
  return "";
}

/** Hook legacy window.solana and poll for late provider injection. */
function install(): void {
  const w = window as unknown as { solana?: Record<string, unknown>; phantom?: { solana?: Record<string, unknown> } };
  if (w.solana) wrapProvider(w.solana);
  if (w.phantom?.solana) wrapProvider(w.phantom.solana);

  // Providers often inject slightly after document_start.
  let tries = 0;
  const poll = setInterval(() => {
    if (w.solana) wrapProvider(w.solana);
    if (w.phantom?.solana) wrapProvider(w.phantom.solana);
    if (++tries > 40) clearInterval(poll); // ~10s
  }, 250);
}

install();
