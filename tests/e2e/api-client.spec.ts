import type { Request } from "@playwright/test";

import { expect, test } from "@playwright/test";

for (const failure of [
  { status: 401, code: "AUTH_INVALID_CREDENTIALS", message: "Nesprávné přihlašovací údaje." },
  { status: 503, code: "AUTH_LOGIN_UNAVAILABLE", message: "Přihlašování je dočasně nedostupné." },
]) {
  test(`login API transport handles ${failure.status} without navigation`, async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Missing Playwright baseURL");
    const requests: Request[] = [];
    await page.route("**/api/v1/auth/login", async (route) => {
      requests.push(route.request());
      await route.fulfill({
        status: failure.status,
        json: { error: { code: failure.code, message: failure.message } },
      });
    });

    await page.goto("/login");
    await context.addCookies([
      { name: "session_id", value: "test-session", url: baseURL, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.getByLabel("Uživatelské jméno").fill("test.teacher");
    await page.getByLabel("Heslo", { exact: true }).fill("incorrect-password");
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(failure.message);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Přihlásit se" })).toBeEnabled();

    expect(requests).toHaveLength(1);
    const request = requests[0];
    if (!request) throw new Error("Login did not reach the API");
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({
      username: "test.teacher",
      password: "incorrect-password",
    });
    const headers = await request.allHeaders();
    expect(headers["x-requested-with"]).toBe("bod");
    expect(headers.cookie).toContain("session_id=test-session");
  });
}
