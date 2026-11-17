// Self-host MediaPipe wasm so the browser never fetches code from a CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
try {
  const pkgDir = path.dirname(require.resolve("@mediapipe/tasks-vision"));
  const out = path.resolve("public/mediapipe/wasm");
  mkdirSync(out, { recursive: true });
  cpSync(path.join(pkgDir, "wasm"), out, { recursive: true });
  console.log("[mediapipe] wasm copied to public/mediapipe/wasm");
} catch (e) {
  console.warn("[mediapipe] could not copy wasm:", e.message);
}
if (!existsSync("public")) mkdirSync("public");
