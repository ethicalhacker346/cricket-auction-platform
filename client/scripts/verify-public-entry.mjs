import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { initialAssetPaths } from "./public-precache.mjs";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(dist, ".vite/manifest.json"), "utf8"),
);
const assets = initialAssetPaths(manifest);
let scriptBytes = 0;
let scriptGzip = 0;
let cssGzip = 0;
for (const file of assets) {
  const data = await readFile(path.join(dist, file));
  if (file.endsWith(".js")) {
    scriptBytes += data.length;
    scriptGzip += gzipSync(data).length;
  }
  if (file.endsWith(".css")) cssGzip += gzipSync(data).length;
}
assert(scriptBytes < 450 * 1024, `Initial JS exceeded 450 KiB: ${scriptBytes}`);
assert(
  scriptGzip < 150 * 1024,
  `Initial compressed JS exceeded 150 KiB: ${scriptGzip}`,
);
assert(
  cssGzip < 85 * 1024,
  `Initial compressed CSS exceeded 85 KiB: ${cssGzip}`,
);
const forbidden =
  /AuctionArena3D|LiveAuction|AuctionRounds|AdminDashboard|AdminSection|PieChart|jspdf|html2canvas|motion-vendor|socket-vendor/;
assert(
  ![...assets].some((file) => forbidden.test(file)),
  "Unopened heavy page leaked into the public entry",
);
const sw = await readFile(path.join(dist, "sw.js"), "utf8");
assert(
  !forbidden.test(sw),
  "Unopened heavy route leaked into the service-worker precache",
);
for (const key of [
  "src/pages/LoginPage.tsx",
  "src/pages/RegisterPage.tsx",
  "src/features/auction/pages/LiveAuctionPage.tsx",
]) {
  const file = manifest[key]?.file;
  assert(file, `Missing lazy page: ${key}`);
  assert(!assets.has(file), `Lazy page is statically imported: ${key}`);
  assert(!sw.includes(`url:"${file}"`), `Lazy page is precached: ${key}`);
}
assert(
  sw.includes("registerSW.js"),
  "Offline HTML dependency registerSW.js was not precached",
);
for (const width of [256, 512]) {
  const bytes = (
    await stat(path.join(dist, `images/gullybid-crest-${width}.webp`))
  ).size;
  assert(
    bytes < 60 * 1024,
    `Brand crest exceeded 60 KiB: ${width}w, ${bytes} bytes`,
  );
}
console.log(
  JSON.stringify(
    {
      initialScriptKiB: +(scriptBytes / 1024).toFixed(2),
      initialScriptGzipKiB: +(scriptGzip / 1024).toFixed(2),
      initialCssGzipKiB: +(cssGzip / 1024).toFixed(2),
      initialAssets: [...assets],
      lazyPagesPrecached: 0,
    },
    null,
    2,
  ),
);
