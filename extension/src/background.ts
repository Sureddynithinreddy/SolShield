/**
 * Background service worker. Receives scan requests from content scripts,
 * calls the SolShield backend /api/scan, and returns a compact verdict.
 * The backend URL is configurable via extension storage (set in the popup).
 */
import type { ScanVerdict } from "./protocol";

const DEFAULT_API = "http://localhost:8787";

async function getApiBase(): Promise<string> {
  try {
    const { apiBase } = await chrome.storage.local.get("apiBase");
    return (apiBase as string) || DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
}

interface ScanMsg {
  type: "scan";
  method: ScanVerdict["requestType"];
  payload: string;
  origin: string;
}

async function scan(msg: ScanMsg): Promise<ScanVerdict> {
  const api = (await getApiBase()).replace(/\/$/, "");

  // signMessage isn't a transaction; surface a light advisory verdict.
  if (msg.method === "signMessage") {
    return {
      verdict: "caution",
      score: 15,
      summary:
        "This site asked you to sign a message. Messages can authorize sign-ins (SIWS) or, if crafted maliciously, approvals. Only sign messages you understand.",
      firedRules: [],
      balanceChanges: [],
      scanSource: "local",
      requestType: msg.method,
      dappDomain: msg.origin,
    };
  }

  // signAllTransactions carries a JSON array of base64 txs; scan the first.
  let transaction = msg.payload;
  if (msg.method === "signAllTransactions") {
    try {
      const arr = JSON.parse(msg.payload) as string[];
      transaction = arr[0] ?? "";
    } catch {
      transaction = "";
    }
  }

  const res = await fetch(`${api}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction, origin: msg.origin }),
  });
  const j = await res.json();
  const s = j?.scenario;
  if (!j?.ok || !s) {
    throw new Error(j?.error ?? "scan failed");
  }

  return {
    verdict: s.verdict,
    score: s.score,
    summary: s.summary,
    firedRules: s.firedRules ?? [],
    balanceChanges: s.balanceChanges ?? [],
    scanSource: s.scanSource ?? "backend",
    requestType: msg.method,
    dappDomain: s.dappDomain ?? msg.origin,
  };
}

chrome.runtime.onMessage.addListener((msg: ScanMsg, _sender, sendResponse) => {
  if (msg?.type !== "scan") return false;
  scan(msg)
    .then((v) => sendResponse(v))
    .catch(() =>
      sendResponse({
        verdict: "caution",
        score: 0,
        summary: "SolShield's scanner is unreachable. Review this transaction carefully.",
        firedRules: [],
        balanceChanges: [],
        scanSource: "unavailable",
        requestType: msg.method,
        dappDomain: msg.origin,
      } satisfies ScanVerdict)
    );
  return true; // keep the message channel open for the async response
});
