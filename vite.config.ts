import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** crossorigin breaks script/css loading under Electron file:// and app:// */
function stripCrossoriginForElectron(): Plugin {
  return {
    name: "strip-crossorigin-for-electron",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, "").replace(/type="module"\s+/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCrossoriginForElectron()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/app.js",
        inlineDynamicImports: true,
      },
    },
  },
});
