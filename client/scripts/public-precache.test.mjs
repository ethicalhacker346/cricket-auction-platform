import { test } from "node:test";
import assert from "node:assert/strict";
import { initialAssetPaths } from "./public-precache.mjs";

test("the PWA shell follows static dependencies, not unopened dynamic routes", () => {
  const paths = initialAssetPaths({
    "index.html": {
      file: "assets/index.js",
      imports: ["react", "shared"],
      dynamicImports: ["auction"],
      css: ["assets/index.css"],
      assets: ["assets/geist.woff2"],
    },
    react: { file: "assets/react.js", imports: ["shared"] },
    shared: { file: "assets/shared.js", imports: ["react"] },
    auction: { file: "assets/AuctionArena3D.js" },
  });
  assert(paths.has("assets/react.js"));
  assert(paths.has("assets/shared.js"));
  assert(paths.has("assets/index.css"));
  assert(paths.has("assets/geist.woff2"));
  assert(paths.has("registerSW.js"));
  assert(!paths.has("assets/AuctionArena3D.js"));
});
test("a broken manifest fails a build rather than silently omitting offline dependencies", () => {
  assert.throws(
    () =>
      initialAssetPaths({
        "index.html": { file: "assets/index.js", imports: ["missing"] },
      }),
    /Missing Vite manifest entry/,
  );
});
