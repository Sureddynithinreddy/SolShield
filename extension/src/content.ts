/**
 * Content script (isolated world). Bridges the page-world inject script and
 * the background service worker. It injects inject.js into the page, forwards
 * scan requests to the background (which calls the SolShield backend), and
 * relays the verdict + the user's decision back to the page.
 */
import type { ContentMessage, ScanRequestMsg, VerdictMsg } from "./protocol";

// 1) Inject the page-world provider wrapper as early as possible.
function injectPageScript() {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inject.js");
  s.async = false;
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}
injectPageScript();

// 2) Relay messages between the page and the background worker.
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const data = event.data as ScanRequestMsg | ContentMessage | undefined;
  if (!data) return;

  // Scan request from the page -> ask background to scan -> send verdict back.
  if ("source" in data && data.source === "solshield-inject" && data.type === "scan-request") {
    try {
      const verdict = await chrome.runtime.sendMessage({
        type: "scan",
        method: data.method,
        payload: data.payload,
        origin: data.origin,
      });
      const msg: VerdictMsg = {
        source: "solshield-content",
        type: "verdict",
        id: data.id,
        verdict,
      };
      window.postMessage(msg, "*");
    } catch {
      // Background unreachable → tell the page it's unavailable (fail-open to
      // the user's own judgement, shown as "unavailable" source).
      const msg: VerdictMsg = {
        source: "solshield-content",
        type: "verdict",
        id: data.id,
        verdict: {
          verdict: "caution",
          score: 0,
          summary: "SolShield could not reach its scanner. Review this transaction carefully.",
          firedRules: [],
          balanceChanges: [],
          scanSource: "unavailable",
          requestType: data.method,
          dappDomain: data.origin,
        },
      };
      window.postMessage(msg, "*");
    }
  }

  // Decision from the overlay buttons -> echo back so the page resolver fires.
  if ("source" in data && data.source === "solshield-content" && data.type === "decision") {
    // Re-post so the inject-world listener (same window) receives it; the page
    // already posted it, this is a no-op guard for cross-world consistency.
  }
});
