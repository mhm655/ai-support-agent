import { expect, test } from "@playwright/test";

test("landing page renders and links to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/./); // has some title, not a blank/error page
  await page.getByRole("link", { name: "Log in" }).first().click();

  await expect(page).toHaveURL(/\/login$/);
});

test("landing page links to signup", async ({ page }) => {
  await page.goto("/");

  // The visible CTA text varies ("Get started", "Get started free") across
  // the several signup links on the page, so target by href instead.
  await page.locator('a[href="/signup"]').first().click();

  await expect(page).toHaveURL(/\/signup$/);
});
