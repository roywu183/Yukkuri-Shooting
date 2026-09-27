import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5173/");
  await page.locator(".language-switch").waitFor();
  assert.equal(await page.locator(".language-switch button").count(), 3);
  await page.getByRole("button", { name: "日本語" }).click();
  await page.waitForFunction(() => document.querySelector(".hero-actions")?.textContent?.includes("任務一覧へ"));
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  assert.equal(await page.locator("button[data-id='ja']").getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: "test-results/locale-ja-home.png" });
  await page.locator("button[data-action='campaign']").first().click();
  await page.waitForFunction(() => document.querySelector(".workspace")?.textContent?.includes("任務"));
  await page.locator("button[data-action='brief']:not([disabled])").first().click();
  await page.waitForFunction(() => document.querySelector(".brief")?.textContent?.includes("無線ブリーフィング"));
  await page.reload();
  await page.locator(".language-switch").waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  assert.match(await page.locator(".hero-actions").innerText(), /任務一覧へ/);
  await page.getByRole("button", { name: "简体中文" }).click();
  await page.waitForFunction(() => document.querySelector(".hero-actions")?.textContent?.includes("前往任务板"));
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hans");
  await page.getByRole("button", { name: "繁體中文" }).click();
  await page.waitForFunction(() => document.querySelector(".hero-actions")?.textContent?.includes("前往任務板"));
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hant");
  assert.deepEqual(errors, []);
  console.log("PASS: three language buttons, translated menu, and saved preference");
} finally {
  await browser.close();
}
