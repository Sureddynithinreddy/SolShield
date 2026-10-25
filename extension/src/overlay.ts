import type { ScanVerdict } from "./protocol";

/**
 * Minimal, dependency-free overlay rendered in the page DOM. Shows a loading
 * state while scanning, then the verdict with Proceed / Reject. Styling is
 * inline + a small injected stylesheet (overlay.css) for the risk colors.
 */

const VERDICT_COLOR: Record<string, string> = {
  safe: "#34d399",
  caution: "#fbbf24",
  dangerous: "#f43f5e",
};

export interface OverlayHandle {
  update: (v: ScanVerdict) => void;
  close: () => void;
}

function ensureStyles(): void {
  if (document.getElementById("solshield-styles")) return;
  const style = document.createElement("style");
  style.id = "solshield-styles";
  style.textContent = "@keyframes solshield-spin{to{transform:rotate(360deg)}}";
  document.documentElement.appendChild(style);
}

export function renderOverlay(
  id: string,
  method: string,
  onDecide: (d: "allow" | "block") => void
): OverlayHandle {
  ensureStyles();
  const root = document.createElement("div");
  root.id = `solshield-${id}`;
  root.setAttribute("data-solshield", "overlay");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:rgba(7,11,22,0.72)",
    "backdrop-filter:blur(4px)",
    "font-family:Inter,system-ui,sans-serif",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "width:380px",
    "max-width:92vw",
    "max-height:88vh",
    "overflow:auto",
    "background:#0e1526",
    "border:1px solid rgba(255,255,255,0.08)",
    "border-radius:16px",
    "box-shadow:0 20px 60px -24px rgba(0,0,0,0.8)",
    "color:#e2e8f0",
    "padding:20px",
  ].join(";");
  root.appendChild(card);
  document.documentElement.appendChild(root);

  const renderLoading = () => {
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#22d3ee,#8b5cf6)"></div>
        <strong style="font-size:15px">SolShield</strong>
      </div>
      <div style="margin-top:16px;display:flex;align-items:center;gap:10px;color:#94a3b8;font-size:14px">
        <span style="width:16px;height:16px;border:2px solid #22d3ee;border-right-color:transparent;border-radius:50%;display:inline-block;animation:solshield-spin 0.8s linear infinite"></span>
        Analyzing ${escapeHtml(method)}…
      </div>`;
  };
  renderLoading();

  const update = (v: ScanVerdict) => {
    const color = VERDICT_COLOR[v.verdict] ?? "#94a3b8";
    const label = v.verdict.charAt(0).toUpperCase() + v.verdict.slice(1);
    const isDanger = v.verdict === "dangerous";

    const rules = v.firedRules
      .slice(0, 5)
      .map(
        (r) =>
          `<div style="padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;margin-top:6px">
             <div style="font-size:13px;font-weight:600">${escapeHtml(r.title)} ${
            r.hardBlock ? '<span style="color:#f43f5e;font-size:11px">· hard block</span>' : ""
          }</div>
             <div style="font-size:12px;color:#94a3b8;margin-top:2px">${escapeHtml(r.explanation)}</div>
           </div>`
      )
      .join("");

    const balances = v.balanceChanges
      .map((b) => {
        const out = b.amount < 0;
        return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:8px;margin-top:6px">
            <span style="color:#cbd5e1">${out ? "You send" : "You receive"} ${escapeHtml(b.symbol)}</span>
            <span style="color:${out ? "#f43f5e" : "#34d399"};font-weight:600">${b.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>`;
      })
      .join("");

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#22d3ee,#8b5cf6)"></div>
          <strong style="font-size:15px">SolShield</strong>
        </div>
        <span style="background:${color}22;color:${color};border:1px solid ${color}55;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700">${label} · ${v.score}</span>
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:6px">${escapeHtml(v.dappDomain)} · ${escapeHtml(v.requestType)} · ${v.scanSource}</div>
      <p style="font-size:14px;line-height:1.5;margin:14px 0 4px;color:${isDanger ? "#fecaca" : "#cbd5e1"}">${escapeHtml(v.summary)}</p>
      ${balances ? `<div style="margin-top:10px">${balances}</div>` : ""}
      ${rules ? `<div style="margin-top:12px">${rules}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px">
        <button data-act="block" style="padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:${isDanger ? "linear-gradient(90deg,#22d3ee,#8b5cf6)" : "rgba(255,255,255,0.04)"};color:${isDanger ? "#070b16" : "#e2e8f0"};font-weight:700;cursor:pointer">Reject</button>
        <button data-act="allow" style="padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:${isDanger ? "rgba(255,255,255,0.04)" : "linear-gradient(90deg,#22d3ee,#8b5cf6)"};color:${isDanger ? "#e2e8f0" : "#070b16"};font-weight:700;cursor:pointer">${isDanger ? "Override" : "Proceed"}</button>
      </div>
      <div style="font-size:10px;color:#475569;text-align:center;margin-top:8px">SolShield never sees your keys. On Proceed, your wallet's own approval follows.</div>`;

    card.querySelector('[data-act="allow"]')?.addEventListener("click", () => onDecide("allow"));
    card.querySelector('[data-act="block"]')?.addEventListener("click", () => onDecide("block"));
  };

  const close = () => root.remove();

  return { update, close };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
