// Disposable local school only. Saves and restores the teacher's attendance fixture.
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");

async function main() {
  const [fixturePath, output] = process.argv.slice(2);
  if (!fixturePath || !output)
    throw new Error("Usage: node tests/e2e/mobile-workflows.cjs access.json output-directory");
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  assert(
    fixture.project.startsWith("bod-preview-") && new URL(fixture.origin).hostname === "127.0.0.1",
    "Use the disposable local preview school.",
  );
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const errors = [],
    report = [];
  let teacherContext, baseline, lessonId;
  const headers = { Origin: fixture.origin, "X-Requested-With": "bod" };
  try {
    for (const role of ["teacher", "parent", "manager", ...(fixture.admin ? ["admin"] : [])]) {
      const context = await browser.newContext({
        baseURL: fixture.origin,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      if (role === "teacher") teacherContext = context;
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/login");
      await page.getByLabel("Uživatelské jméno").fill(fixture[role].username);
      await page.getByLabel("Heslo", { exact: true }).fill(fixture[role].password);
      await page.getByRole("button", { name: "Přihlásit se" }).click();
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByText("Pracovní prostor", { exact: true })).toHaveCount(0);
      for (const [width, height] of [
        [390, 844],
        [320, 568],
        [844, 390],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("button", { name: "Otevřít navigaci" }).click();
        const menu = page.getByRole("dialog", { name: "Navigace", exact: true });
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole("button", { name: "Zavřít navigaci", exact: true }),
        ).toHaveCount(1);
        await expect(menu.getByRole("button", { name: "Zavřít", exact: true })).toHaveCount(0);
        const logout = await menu.getByRole("button", { name: "Odhlásit se" }).boundingBox();
        assert(
          logout.y >= 0 && logout.y + logout.height <= height,
          `${role}: logout outside ${width}×${height}`,
        );
        report.push({ role, menu: { width, height, logoutBottom: logout.y + logout.height } });
        await page.screenshot({ path: path.join(output, `${role}-menu-${width}.png`) });
        await menu.getByRole("button", { name: "Zavřít navigaci" }).click();
        await expect(page.getByRole("button", { name: "Otevřít navigaci" })).toBeFocused();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const targets =
        role === "teacher"
          ? [`/app/classbook?den=${fixture.day}`, "/app/timetable"]
          : role === "admin"
            ? ["/app/settings/access"]
            : role === "parent"
              ? ["/app", "/app/classbook?view=attendance", "/app/classbook?view=excuses"]
              : ["/app", "/app/school", "/app/rooms", "/app/timetable?view=manage"];
      for (const target of targets) {
        await page.goto(target);
        await expect(page.getByRole("progressbar")).toHaveCount(0);
        await page.waitForTimeout(300);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          [],
          `${role}: axe ${target}`,
        );
        for (const fontSize of ["100%", "200%"])
          for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await page
              .locator("html")
              .evaluate((el, value) => (el.style.fontSize = value), fontSize);
            const layout = await page.locator(".app-main").evaluate((el) => ({
              width: el.clientWidth,
              scrollWidth: el.scrollWidth,
              height: el.scrollHeight,
            }));
            assert(
              layout.scrollWidth <= layout.width + 1,
              `${role}: overflow ${target} ${width}/${fontSize}`,
            );
            report.push({ role, target, width, fontSize, ...layout });
          }
        await page.locator("html").evaluate((el) => (el.style.fontSize = "100%"));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator(".app-main").evaluate((el) => (el.scrollTop = 0));
        await page.screenshot({
          path: path.join(output, `${role}-${target.replaceAll(/[^a-z0-9]/gi, "-")}.png`),
        });
      }
      if (role === "teacher") {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(`/app/classbook?den=${fixture.day}`);
        const roster = page.getByRole("region", { name: "Docházka hodiny" });
        await expect(roster.getByRole("row")).toHaveCount(30);
        const checkbox = roster.getByRole("checkbox", { name: "Chybí: Adam Bartoš", exact: true });
        await expect(checkbox).toBeVisible();
        const first = await checkbox.boundingBox(),
          bar = await page.locator(".lesson-save-bar").boundingBox();
        assert(
          first.y + first.height <= bar.y,
          "First pupil's attendance is covered by save controls.",
        );
        const contentHeight = await page.locator(".app-main").evaluate((el) => el.scrollHeight);
        assert(contentHeight < 3000, "Mobile roster is too long for 30 pupils.");
        const details = await (
          await context.request.get(
            `/api/v1/classbook/my-lessons?date_from=${fixture.day}&date_to=${new Date(Date.parse(`${fixture.day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)}`,
          )
        ).json();
        const lesson = details.find((entry) => entry.status === "draft");
        assert(lesson);
        lessonId = lesson.id;
        const read = await (
          await context.request.get(`/api/v1/classbook/lessons/${lessonId}`)
        ).json();
        baseline = read.participants.map((person) => ({
          student_id: person.student_id,
          status: person.attendance?.status ?? "present",
          late_minutes: person.attendance?.late_minutes ?? null,
          missed_minutes: person.attendance?.missed_minutes ?? null,
          note: person.attendance?.note ?? null,
        }));
        const before = await checkbox.isChecked();
        await checkbox.setChecked(!before);
        await page.route("**/api/v1/classbook/lessons/*/attendance", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: { code: "DATABASE_UNAVAILABLE", message: "Kontrolovaná chyba spojení" },
            }),
          }),
        );
        await page.getByRole("button", { name: "Uložit zápis", exact: true }).click();
        await expect(page.getByText("Kontrolovaná chyba spojení")).toBeVisible();
        await expect(checkbox).toBeChecked({ checked: !before });
        await page.unroute("**/api/v1/classbook/lessons/*/attendance");
        const saved = page.waitForResponse(
          (r) =>
            r.request().method() === "PUT" && r.url().includes(`/lessons/${lessonId}/attendance`),
        );
        await page.getByRole("button", { name: "Uložit zápis", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await page.reload();
        await expect(
          roster.getByRole("checkbox", { name: "Chybí: Adam Bartoš", exact: true }),
        ).toBeChecked({ checked: !before });
        report.push({
          role,
          oneTapAttendance: true,
          failedSavePreserved: true,
          reloadVerified: true,
          contentHeight,
          firstControlBottom: first.y + first.height,
          saveBarTop: bar.y,
        });
      }
      if (role !== "teacher") await context.close();
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(
      "PASS: responsive menus, portrait and landscape, role overviews, 200% text, axe, compact 30-pupil roster, actual save/reload and failure recovery.",
    );
  } finally {
    if (baseline && teacherContext) {
      const restored = await teacherContext.request.put(
        `/api/v1/classbook/lessons/${lessonId}/attendance`,
        { headers, data: { records: baseline } },
      );
      assert.equal(restored.status(), 200, "Attendance fixture restoration failed");
    }
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
