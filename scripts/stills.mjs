// usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale] [compositionId]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

if (process.env.REMOTION_TMP) {
  fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP;
}

const [prefix, frames, scale = "0.5", compId = "PaxSilicaShort"] = process.argv.slice(2);
if (!prefix || !frames) {
  console.error("Usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale] [compositionId]");
  process.exit(1);
}
fs.mkdirSync(path.dirname(path.resolve(prefix + "0.jpg")), { recursive: true });

const browserExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: compId, browserExecutable, chromiumOptions });

const onBrowserLog = (l) => {
  if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300));
};

for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    frame: f,
    output: `${prefix}${f}.jpg`,
    imageFormat: "jpeg",
    jpegQuality: 88,
    scale: Number(scale),
    browserExecutable,
    chromiumOptions,
    timeoutInMilliseconds: 180000,
    onBrowserLog,
  });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
