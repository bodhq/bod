import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

test("shared form styles survive stylesheet ordering and theme changes", async ({ page }) => {
  await page.goto("/login");
  const mark = page.getByRole("img", { name: "bod logo" }).locator("use");
  await expect
    .poll(() => mark.evaluate((el) => (el instanceof SVGGraphicsElement ? el.getBBox().width : 0)))
    .toBeGreaterThan(250);
  const username = page.getByRole("textbox", { name: "Uživatelské jméno" });
  await expect(username).toHaveCSS("padding-top", "8px");
  await expect(username).toHaveCSS("border-top-width", "1px");
  await expect(username).toHaveCSS("border-top-style", "solid");
  const button = page.getByRole("button", { name: "Přihlásit se" });
  await expect(button).toHaveCSS("padding-top", "8px");
  await page.getByRole("button", { name: "Přepnout motiv" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 18, 22)");
  await expect(username).toHaveCSS("background-color", "rgb(25, 28, 34)");
});

test("login assets are public while account pages stay protected", async ({ page }) => {
  await page.goto("/login");
  for (const asset of ["/brand/logo.svg", "/brand/login-tile.svg"]) {
    const response = await page.request.get(asset);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  }
  const font = await page.request.get("/fonts/plus-jakarta-sans.ttf");
  expect(font.status()).toBe(200);
  expect((await font.body()).subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]));
  for (const path of ["/app/settings/profile", "/brand-private"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/login$/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("textbox", { name: "Uživatelské jméno" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("login keeps its ambient tiles moving without moving the form and honors reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  const pattern = page.locator(".login-pattern");
  const tiles = pattern.locator(".login-pattern__tiles");
  await expect(pattern).toHaveAttribute("aria-hidden", "true");
  expect(await pattern.locator("*").count()).toBeLessThan(20);
  const movement = await tiles.evaluate(async (el) => {
    const sample = () => {
      const transform = getComputedStyle(el, "::before").transform;
      return {
        x: transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41,
        formY: document.querySelector("form")?.getBoundingClientRect().top,
      };
    };
    const before = sample();
    for (let frame = 0; frame < 20; frame++) await new Promise(requestAnimationFrame);
    return { before, after: sample(), mask: getComputedStyle(el, "::before").maskImage };
  });
  expect(Math.abs(movement.after.x - movement.before.x)).toBeGreaterThan(0.5);
  expect(movement.after.formY).toBe(movement.before.formY);
  const assetUrl = movement.mask.match(/^url\(["']?(.+?)["']?\)$/)?.[1];
  if (!assetUrl) throw new Error("Missing login tile texture");
  const texture = await page.request.get(assetUrl);
  expect(texture.status()).toBe(200);
  expect(texture.headers()["content-type"]).toContain("image/svg+xml");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await tiles.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("none");
  expect(await tiles.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    localStorage.setItem(
      "bod-appearance-storage",
      JSON.stringify({ state: { reduceMotion: true }, version: 1 }),
    );
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  expect(await tiles.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("none");
  expect(await tiles.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("none");
});
