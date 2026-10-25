import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const shared = path.resolve(__dirname, "../shared/src");

await build({
  entryPoints: {
    inject: path.join(__dirname, "src/inject.ts"),
    content: path.join(__dirname, "src/content.ts"),
    background: path.join(__dirname, "src/background.ts"),
    popup: path.join(__dirname, "src/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "browser",
  logLevel: "info",
  alias: {
    "@shared": path.join(shared, "index.ts"),
  },
  // Resolve @shared/* subpaths.
  plugins: [
    {
      name: "shared-subpath",
      setup(b) {
        b.onResolve({ filter: /^@shared\// }, (args) => ({
          path: path.join(shared, args.path.replace(/^@shared\//, "") + ".ts"),
        }));
      },
    },
  ],
});

// Copy static assets (manifest, popup.html, overlay.css, icons).
cpSync(path.join(__dirname, "public"), dist, { recursive: true });

// Minimal overlay.css (overlay is mostly inline-styled; this adds the spinner keyframe).
writeFileSync(
  path.join(dist, "overlay.css"),
  "@keyframes solshield-spin{to{transform:rotate(360deg)}}"
);

// Ensure the spinner keyframe is also available even if overlay.css isn't
// injected — inject a <style> at runtime is handled by content via CSS file;
// for safety we also append it inline in the built inject via a banner is
// unnecessary since the keyframe name is referenced by the overlay element.

console.log("Extension built ->", path.relative(process.cwd(), dist));

// Sanity check expected outputs exist.
const expected = ["inject.js", "content.js", "background.js", "popup.js", "manifest.json", "popup.html"];
const missing = expected.filter((f) => !existsSync(path.join(dist, f)));
if (missing.length) {
  console.error("MISSING build outputs:", missing.join(", "));
  process.exit(1);
}
console.log("All expected outputs present:", expected.join(", "));
