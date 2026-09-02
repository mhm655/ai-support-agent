import { defineConfig, devices } from "@playwright/test";

// e2e tests run against a production build of the frontend only — no real
// Supabase/Gemini backend is available in CI, so these tests cover what
// can be verified without one: static pages render, client-side form
// validation works, navigation between public pages works. Anything that
// needs a live backend (login, chat, RAG) is covered by the backend's own
// pytest suite and by the frontend unit tests that mock the API layer.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- -p 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://ci-dummy.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_dummy",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000",
    },
  },
});
