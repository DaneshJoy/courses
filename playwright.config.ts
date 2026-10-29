import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4179/courses/" },
  webServer: {
    command: "PORTAL_BASE=/courses/ npm run dev -- --host 127.0.0.1 --port 4179",
    url: "http://127.0.0.1:4179/courses/",
    reuseExistingServer: !process.env.CI,
  },
});
