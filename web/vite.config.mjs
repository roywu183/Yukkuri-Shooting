import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __MOBILE_EDITION__: JSON.stringify(mode === "mobile") },
  plugins: mode === "mobile" ? [{
    name: "mobile-edition",
    transformIndexHtml: (html) => html.replace("<html ", '<html data-mobile-edition="true" '),
  }] : [],
  optimizeDeps: { noDiscovery: true, include: [], exclude: ["three"] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
}));
