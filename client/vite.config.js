import path from "path";
import { fileURLToPath } from "url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { publicPrecacheTransform } from "./scripts/public-precache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "GullyBid — Cricket Auction OS",
        short_name: "GullyBid",
        description:
          "Bring your cricket tournament, franchises, and player auction together.",
        start_url: "/",
        display: "standalone",
        background_color: "#0c1412",
        theme_color: "#0c1412",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/*.map"],
        manifestTransforms: [
          publicPrecacheTransform(path.resolve(__dirname, "dist")),
        ],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io(?:\/|$)/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /^\/assets\/.*\.(?:js|css|woff2)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "gullybid-route-assets-v1",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/images\/.*\.webp$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "gullybid-public-images-v1",
              expiration: { maxEntries: 20, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),

    process.env.ANALYZE === "true" &&
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
    manifest: true,
    sourcemap: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": [
            "react",
            "react-dom",
            "react-dom/client",
            "react-router-dom",
          ],
          "query-vendor": ["@tanstack/react-query"],
          "motion-vendor": ["framer-motion"],
          "toast-vendor": ["react-hot-toast"],
          "socket-vendor": ["socket.io-client"],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  server: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
    port: 5173,
    proxy: {
      "/socket.io": {
        target: process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
      "/api": {
        target: process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
    port: 4173,
  },
});
