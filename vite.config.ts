import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const offline = process.env.PORTAL_OFFLINE === "1";

export default defineConfig({
  base: process.env.PORTAL_BASE ?? "/courses/",
  plugins: [react()],
  build: offline ? {
    modulePreload: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
      },
    },
  } : undefined,
});
