import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** crossorigin breaks script/css loading under Electron file:// and app:// */
function stripCrossoriginForElectron(): Plugin {
  return {
    name: "strip-crossorigin-for-electron",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      let output = html.replace(/\s+crossorigin/g, "").replace(/type="module"\s+/g, "");

      const scriptMatch = output.match(/<script[^>]*src="[^"]*app\.js"[^>]*><\/script>/);
      if (scriptMatch) {
        const scriptTag = scriptMatch[0].includes("defer")
          ? scriptMatch[0]
          : scriptMatch[0].replace("<script", "<script defer");
        output = output.replace(scriptMatch[0], "");
        output = output.replace("</body>", `${scriptTag}\n</body>`);
      }

      if (output.includes("</body>")) {
        return output.replace(
          "</body>",
          `<script>
            window.addEventListener('error', function(e) {
              var root = document.getElementById('root');
              if (root) root.innerHTML = '<pre style="padding:16px;color:#b42318">Script error: ' + e.message + '</pre>';
            });
          </script></body>`,
        );
      }
      return output;
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
