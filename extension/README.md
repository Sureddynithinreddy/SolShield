# SolShield Browser Extension (MV3)

A Manifest V3 extension that sits between a Solana dApp and your wallet. It wraps the wallet
provider in the page, intercepts `signTransaction` / `signAllTransactions` /
`signAndSendTransaction` / `signMessage`, holds the request, scans it via the SolShield
backend, shows a risk overlay, and only forwards the call to your wallet if you allow it.

SolShield never sees your private keys — only the unsigned transaction is inspected.

## Build

```bash
cd extension
npm install
npm run build        # outputs dist/
```

## Load it in a Chromium browser

1. Build (above).
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the `extension/dist` folder.
5. Click the SolShield toolbar icon and set the backend URL (default `http://localhost:8787`).
6. Visit any Solana dApp and trigger a signing request — the SolShield overlay appears first.

## Architecture

| File             | World          | Role                                                            |
| ---------------- | -------------- | --------------------------------------------------------------- |
| `inject.ts`      | page           | Wraps the wallet provider, intercepts signing, renders overlay  |
| `overlay.ts`     | page           | Dependency-free verdict overlay (loading → verdict → decision)  |
| `content.ts`     | isolated       | Injects the page script; relays scan requests to the background |
| `background.ts`  | service worker | Calls the SolShield backend `/api/scan`, returns a verdict      |
| `popup.ts/html`  | popup          | Set/persist the backend URL                                     |

Detection logic and types are shared with the backend via the `shared/` package, so the
extension speaks the same verdict/rule vocabulary as everything else.

> If the backend is unreachable, the overlay shows an "unavailable" verdict and asks you to
> review the transaction manually (fail-safe), rather than silently passing it through.
