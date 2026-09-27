import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5173/");
await page.waitForTimeout(2500);
await page.screenshot({ path: "test-results/home.png" });
await page.getByRole("button", { name: "模型展示", exact: true }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "test-results/gallery.png" });
await page.getByRole("button", { name: "任務板", exact: true }).click();
await page.screenshot({ path: "test-results/missions.png" });
console.log({ errors });
writeFileSync("test-results/smoke.json", JSON.stringify({ errors }, null, 2));
await browser.close();
