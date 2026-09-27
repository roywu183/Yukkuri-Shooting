import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  optimizeDeps: { noDiscovery: true, include: [], exclude: ["three"] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
