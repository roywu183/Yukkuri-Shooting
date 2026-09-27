import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "模型展示", exact: true }).click();
  await page.locator('[data-action="helper-preview"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/chrome-models-helper.png" });
  await page.locator('[data-action="helper-preview"]').click();
  for (let i = 0; i < 2; i++)
    await page.locator('[data-action="rotate"][data-id="1"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/chrome-models-side.png" });
  for (let i = 0; i < 2; i++)
    await page.locator('[data-action="rotate"][data-id="1"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/chrome-models-back.png" });
} finally {
  await browser.close();
}
