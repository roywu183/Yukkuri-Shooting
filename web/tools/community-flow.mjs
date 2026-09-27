import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
    const p = window.testApp.store.value;
    p.completed = ["park_01"];
    p.community = 10000;
    p.hats = { common_hat: 2, rare_hat: 1 };
    window.testApp.store.save();
  });
  await page.getByRole("button", { name: "社區聯絡簿", exact: true }).click();
  const helpers = await page
    .locator('[data-action="recruit"]')
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.id));
  assert.equal(helpers.length, 3);
  for (const id of helpers)
    await page.locator(`[data-action="recruit"][data-id="${id}"]`).click();
  for (const id of helpers)
    await page
      .locator(`[data-action="select-helper"][data-id="${id}"]`)
      .click();
  await page
    .locator(`[data-action="upgrade-helper"][data-id="${helpers[0]}"]`)
    .click();
  await page
    .locator(`[data-action="upgrade-helper"][data-id="${helpers[0]}"]`)
    .click();
  assert.equal(
    await page
      .locator(`[data-action="upgrade-helper"][data-id="${helpers[0]}"]`)
      .isDisabled(),
    true,
  );
  await page.locator('[data-action="exchange"][data-id="common_hat"]').click();
  const progress = await page.evaluate(() => window.testApp.store.value);
  assert.equal(progress.loadouts.park.length, 2);
  assert.equal(progress.helpers[helpers[0]], 3);
  assert.equal(progress.hats.common_hat, 1);
  assert.ok(progress.community >= 0);
  await page.screenshot({ path: "test-results/community.png" });
  await page.getByRole("button", { name: "地圖冊", exact: true }).click();
  await page.locator('[data-action="start-free"]').click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(150);
  const deployed = await page.evaluate(() =>
    window.testApp.session.helpers.map((h) => ({
      id: h.helperId,
      helper: h.helper,
    })),
  );
  assert.deepEqual(
    deployed.map((h) => h.id).sort(),
    progress.loadouts.park.toSorted(),
  );
  assert.ok(deployed.every((h) => h.helper));
  await page.keyboard.press("Escape");
  await page.locator('[data-action="leave"]').click();
  await page.locator('.result [data-action="free"]').click();
  await page.reload();
  await page.waitForSelector(".hero");
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("highground.web.v1")),
  );
  assert.deepEqual(restored.helpers, progress.helpers);
  assert.deepEqual(restored.loadouts, progress.loadouts);
  assert.equal(restored.hats.common_hat, 1);
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/community-flow.json",
    JSON.stringify(
      {
        completed: true,
        helpers: progress.helpers,
        loadouts: progress.loadouts,
        hatCount: restored.hats.common_hat,
        deployed,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("協力者招募、三級升級、兩名出勤、頭飾兌換及重新載入保存通過");
} finally {
  await browser.close();
}
