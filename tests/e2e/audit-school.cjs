// Run against a disposable school fixture; credentials stay outside the repository.
const fs = require("node:fs/promises");
const path = require("node:path");
const { default: AxeBuilder } = require("@axe-core/playwright");
const { chromium, expect } = require("@playwright/test");

async function main() {
  const [fixtureFile, outputDirectory] = process.argv.slice(2);
  if (!fixtureFile || !outputDirectory)
    throw new Error("Usage: node tests/e2e/audit-school.cjs access.json output-directory");
  const fixture = JSON.parse(await fs.readFile(fixtureFile, "utf8"));
  await fs.mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  const reports = [];
  const errors = [];
  try {
    const context = await browser.newContext({
      baseURL: fixture.origin,
      viewport: { width: 1440, height: 1050 },
      colorScheme: "light",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/login");
    await page.getByLabel("Uživatelské jméno").fill(fixture.manager.username);
    await page.getByLabel("Heslo", { exact: true }).fill(fixture.manager.password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page).toHaveURL(/\/app$/);
    const pages = [
      "/app",
      `/app/classbook?den=${fixture.day}`,
      "/app/school",
      "/app/rooms",
      "/app/timetable",
      "/app/settings/profile",
      "/app/settings/appearance",
      "/app/settings/security",
    ];
    for (const target of pages) {
      await page.goto(target);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Wait for actual page data, without requiring a quiet background polling connection.
      await expect(page.getByRole("progressbar")).toHaveCount(0);
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const entry = {
        target,
        title: await page.locator("h1").first().innerText(),
        violations: axe.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map((node) => node.target),
        })),
        layouts: [],
      };
      reports.push(entry);
      const slug = target.split("?")[0].replaceAll("/", "-");
      await page.screenshot({ path: path.join(outputDirectory, `${slug}-desktop.png`) });
      for (const fontSize of ["100%", "200%"])
        for (const width of [1440, 390, 320]) {
          await page.locator("html").evaluate((element, value) => {
            element.style.fontSize = value;
          }, fontSize);
          await page.setViewportSize({ width, height: 1050 });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          );
          const clippedControls = await page
            .locator(".ui-button")
            .evaluateAll((buttons) =>
              buttons
                .filter(
                  (button) =>
                    button.getClientRects().length && button.scrollWidth > button.clientWidth + 2,
                )
                .map((button) => button.textContent.trim()),
            );
          entry.layouts.push({ width, fontSize, overflow, clippedControls });
          if (clippedControls.length)
            errors.push(
              `${target}: clipped buttons at ${width}px / ${fontSize}: ${clippedControls.join(", ")}`,
            );
          if (overflow) errors.push(`${target}: horizontal overflow at ${width}px / ${fontSize}`);
        }
      if (entry.violations.length)
        errors.push(`${target}: ${entry.violations.length} axe violations`);
      await page.locator("html").evaluate((element) => {
        element.style.fontSize = "";
      });
      await page.setViewportSize({ width: 1440, height: 1050 });
      console.log(`${target}: ${entry.title}; axe=${entry.violations.length}`);
    }
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Uživatelské jméno").fill(fixture.teacher.username);
    await page.getByLabel("Heslo", { exact: true }).fill(fixture.teacher.password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/settings/profile");
    const firstName = page.getByLabel("Jméno", { exact: true });
    await firstName.fill(`${await firstName.inputValue()} – rozepsáno`);
    await page.getByRole("link", { name: "Třídnice", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Opustit neuložené změny?" });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Zavřít", exact: true });
    const discard = dialog.getByRole("button", { name: "Zahodit změny a odejít", exact: true });
    await discard.focus();
    await discard.press("Tab");
    await expect(close).toBeFocused();
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(firstName).toHaveValue(/rozepsáno/);
    await page.getByRole("link", { name: "Třídnice", exact: true }).first().click();
    await page.getByRole("button", { name: "Zahodit změny a odejít", exact: true }).click();
    await page.goto(`/app/classbook?den=${fixture.day}`);
    const roster = page.getByRole("region", { name: "Docházka hodiny" });
    await expect(roster.getByRole("row")).toHaveCount(31);
    const radio = page.getByRole("radio", { name: "Přítomen: Adam Bartoš", exact: true });
    await radio.focus();
    await radio.press("ArrowRight");
    await expect(
      page.getByRole("radio", { name: "Chybí: Adam Bartoš", exact: true }),
    ).toBeChecked();
    await page.getByRole("radio", { name: "Chybí: Adam Bartoš", exact: true }).press("ArrowLeft");
    await expect(radio).toBeChecked();
    const metrics = await page.evaluate(() => {
      const measure = (selector) => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        return {
          fontSize: getComputedStyle(element).fontSize,
          width: box.width,
          height: box.height,
        };
      };
      return {
        body: measure("body"),
        student: measure(".attendance-name"),
        attendance: measure(".ui-choice > span"),
        save: measure(".lesson-save-bar button"),
        status: measure(".ui-save-status"),
      };
    });
    const lastNote = page.getByRole("button", {
      name: "Podrobnosti: Veronika Křížová",
      exact: true,
    });
    await lastNote.focus();
    const focusVisible = await lastNote.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const bar = document.querySelector(".lesson-save-bar").getBoundingClientRect();
      return box.top >= 0 && box.bottom <= bar.top;
    });
    if (!focusVisible) errors.push("Attendance note focus is covered by the save bar.");
    await roster.evaluate((element) => element.scrollIntoView({ block: "start" }));
    const teacherAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    if (teacherAxe.violations.length)
      errors.push(`Teacher classbook: ${teacherAxe.violations.map((v) => v.id).join(", ")}`);
    await page.screenshot({ path: path.join(outputDirectory, "classbook-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await roster.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(outputDirectory, "classbook-mobile.png") });
    await page.locator("html").evaluate((element) => {
      element.style.fontSize = "200%";
    });
    await roster.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(outputDirectory, "classbook-text-200.png") });
    const clippedSaveButtons = await page
      .locator(".lesson-save-bar .ui-button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.scrollWidth > button.clientWidth + 2)
          .map((button) => button.textContent),
      );
    if (clippedSaveButtons.length) errors.push("Classbook save button text is clipped at 200%.");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    await page.reload();
    await expect(roster.getByRole("row")).toHaveCount(31);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const darkAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    if (darkAxe.violations.length)
      errors.push(`Dark classbook: ${darkAxe.violations.map((v) => v.id).join(", ")}`);
    await page.screenshot({ path: path.join(outputDirectory, "classbook-dark.png") });
    await fs.writeFile(
      path.join(outputDirectory, "report.json"),
      JSON.stringify(
        {
          reports,
          metrics,
          focusVisible,
          teacherViolations: teacherAxe.violations,
          darkViolations: darkAxe.violations,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw new Error(errors.join("\n"));
    expect(metrics.attendance.height).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(metrics.student.fontSize)).toBeGreaterThanOrEqual(16);
    console.log(
      "PASS: school accessibility, 320–1440px reflow, 200% text, 30 pupils, radio keyboard navigation and readable targets.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
