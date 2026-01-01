import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: "dist",
  manifest: {
    name: "AI Service Exposure",
    version: "0.0.1",
    description:
      "Detect and visualize login pages, privacy policies, and session cookies",
    permissions: ["cookies", "storage", "activeTab"],
    host_permissions: ["<all_urls>"],
  },
  vite: () => ({
    plugins: [],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "preact",
    },
  }),
});
