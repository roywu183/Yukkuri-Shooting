import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => requests.push(r.url()));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.waitForSelector(".hero");
  await page.screenshot({ path: "test-results/production-home.png" });
  await page.getByRole("button", { name: "模型展示", exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/production-models.png" });
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => !!document.pointerLockElement), true);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause");
  await page.locator('[data-action="leave"]').click();
  await page.waitForSelector(".result");
  assert.ok(
    (await page.locator(".save-status").textContent()).includes("已保存"),
  );
  assert.deepEqual(errors, []);
  const environmentInjectedRequests = requests.filter((u) =>
    u.startsWith("http://local.adguard.org/"),
  );
  const applicationRequests = requests.filter(
    (u) => !environmentInjectedRequests.includes(u),
  );
  assert.ok(
    applicationRequests.every(
      (u) => u.startsWith("http://127.0.0.1:4173/") || u.startsWith("data:"),
    ),
  );
  writeFileSync(
    "test-results/production-smoke.json",
    JSON.stringify(
      {
        errors,
        applicationRequests,
        environmentInjectedRequests,
        completed: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "正式 dist 選單、模型、出勤、滑鼠控制與保存通過；遊戲資源皆本機；系統注入請求另外記錄。",
  );
} finally {
  await browser.close();
}
