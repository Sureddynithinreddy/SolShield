/** Popup: lets the user set/persist the SolShield backend URL. */
const DEFAULT_API = "http://localhost:8787";

const input = document.getElementById("api") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const save = document.getElementById("save") as HTMLButtonElement;

chrome.storage.local.get("apiBase").then(({ apiBase }) => {
  input.value = (apiBase as string) || DEFAULT_API;
});

save.addEventListener("click", async () => {
  const value = input.value.trim() || DEFAULT_API;
  await chrome.storage.local.set({ apiBase: value });
  statusEl.textContent = "Saved.";
  setTimeout(() => (statusEl.textContent = ""), 1500);
});
