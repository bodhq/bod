import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`login is accessible in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    await page.getByLabel("Uživatelské jméno").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("login stays readable with enlarged text and on a narrow screen", async ({ page }) => {
  await page.goto("/login");
  const username = page.getByLabel("Uživatelské jméno");
  const before = await username.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  const after = await username.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(after).toBeGreaterThanOrEqual(before * 2);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await username.fill("ucitel");
    await expect(username).toHaveValue("ucitel");
    const button = page.getByRole("button", { name: "Přihlásit se" });
    await button.scrollIntoViewIfNeeded();
    const size = await button.boundingBox();
    expect(size?.height).toBeGreaterThanOrEqual(44);
    await expect(button).toBeInViewport();
  }
});
