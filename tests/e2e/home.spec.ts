import { expect, test } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");
  // Just a simple test to check if the page loads without crashing
  await expect(page).toHaveTitle(/bod/);
});
