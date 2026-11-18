import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Keep DOM regression tests independent of PWA/build-only Vite plugins.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    fakeTimers: {
      toFake: [
        "setTimeout", "clearTimeout", "setInterval", "clearInterval",
        "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame",
      ],
    },
  },
});
