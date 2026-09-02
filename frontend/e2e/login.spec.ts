import { expect, test } from "@playwright/test";

test.describe("login page", () => {
  test("shows the email/password form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    await page.goto("/login");

    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  // No real Supabase backend exists in CI (NEXT_PUBLIC_SUPABASE_URL points at
  // a dummy, unreachable host). This is a genuine end-to-end check that a
  // failed auth call surfaces as a readable error in the UI instead of an
  // unhandled rejection or a silently stuck "Logging in..." button.
  test("surfaces an error when the auth request fails", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password", { exact: true }).fill("hunter2");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login$/);
  });
});
