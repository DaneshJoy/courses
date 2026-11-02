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
  const shahedTab = page.getByRole("tab", { name: "دانشگاه شاهد" });
  const jahadTab = page.getByRole("tab", { name: "جهاد دانشگاهی صنعتی شریف" });
  const otherTab = page.getByRole("tab", { name: "سایر آموزش ها" });
  await expect(shahedTab).toBeVisible();
  await expect(jahadTab).toBeVisible();
  await expect(otherTab).toBeVisible();
  expect(await page.locator(".catalog-tabs").evaluate((element) => getComputedStyle(element).overflowY)).toBe("hidden");
  await expect(shahedTab).toHaveAttribute("aria-selected", "true");
  const accentColor = await shahedTab.evaluate((element) => getComputedStyle(element).color);
  await expect(shahedTab).toHaveCSS("border-bottom-color", accentColor);

  const themeToggle = page.getByRole("button", { name: "تغییر پوسته" });
  await expect(themeToggle.locator("svg")).toHaveCount(2);
  await expect(themeToggle).toHaveCSS("width", "40px");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await expect(themeToggle.locator(initialTheme === "dark" ? ".icon-moon" : ".icon-sun")).toBeVisible();

  await shahedTab.click();
  await expect(page.locator(".course-card").first()).toBeVisible();
  await expect(page.locator(".course-card")).toHaveCount(2);
  await expect(page.locator(".course-card")).toContainText(["دانشگاه شاهد", "دانشگاه شاهد"]);
  await otherTab.click();
  await expect(page.getByText("در حال حاضر هیچ دوره‌ای منتشر نشده است.")).toBeVisible();
  await jahadTab.click();
  const jahadCard = page.locator(".course-card");
  await expect(jahadCard.first()).toBeVisible();
  await expect(jahadCard).toHaveCount(1);
  await expect(jahadCard.first()).toContainText("یادگیری ماشین");

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
