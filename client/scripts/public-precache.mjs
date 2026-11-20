import { readFile } from "node:fs/promises";
import path from "node:path";

/** Vite's static entry graph, explicitly excluding all dynamic imports. */
export function initialAssetPaths(manifest) {
  const paths = new Set(["index.html", "favicon.svg", "registerSW.js"]);
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing Vite manifest entry: ${key}`);
    paths.add(chunk.file);
    for (const file of [...(chunk.css || []), ...(chunk.assets || [])])
      paths.add(file);
    for (const dependency of chunk.imports || []) visit(dependency);
  }
  visit("index.html");
  return paths;
}

/**
 * Lazy routing is ineffective if installing the service worker immediately
 * downloads every unopened route. Precache just the shell's static graph;
 * cache route chunks on demand, using Workbox runtime policies instead.
 */
export function publicPrecacheTransform(outputDirectory) {
  return async (entries) => {
    const manifest = JSON.parse(
      await readFile(path.join(outputDirectory, ".vite/manifest.json"), "utf8"),
    );
    const initial = initialAssetPaths(manifest);
    return {
      manifest: entries.filter((entry) => initial.has(entry.url)),
      warnings: [],
    };
  };
}
