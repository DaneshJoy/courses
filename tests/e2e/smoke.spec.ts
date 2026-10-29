import { expect, test } from "@playwright/test";

test("renders the RTL landing page without overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/courses/");

  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByLabel("فیلترها")).toBeVisible();
  await expect(page.locator("article.course-card").first()).toBeVisible();

  const themeToggle = page.getByRole("button", { name: "تغییر پوسته" });
  await themeToggle.click();
  const theme = await page.locator("html").getAttribute("data-theme");
  expect(theme).toMatch(/^(light|dark)$/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }

  expect(errors).toEqual([]);
});
