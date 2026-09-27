import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [],
  errors = [],
  samples = [];
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
  });
  for (let cycle = 0; cycle < 8; cycle++) {
    for (const map of [
      "park",
      "city",
      "residential",
      "shopping_street",
      "factory",
      "rural",
      "joint",
    ]) {
      await page.evaluate(async (map) => {
        const app = window.testApp;
        app.view.setMap(map);
        app.view.showGallery(true);
        app.view.setMap(map);
      }, map);
      await page.waitForTimeout(80);
    }
    samples.push(await page.evaluate(() => window.testApp.view.metrics()));
  }
  const stable = samples.slice(1);
  assert.equal(new Set(stable.map((s) => s.resources)).size, 1);
  assert.equal(new Set(stable.map((s) => s.geometries)).size, 1);
  assert.equal(new Set(stable.map((s) => s.textures)).size, 1);
  checks.push(
    "56 scene/gallery replacement cycles keep cached and GPU resource counts stable",
  );
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(100);
  // Headless tabs do not consistently expose background visibility. Inject only
  // the browser signal; the actual Input listener and game clock handle it.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForSelector(".pause");
  const elapsed = await page.evaluate(() => window.testApp.session.elapsed);
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(() => window.testApp.session.elapsed),
    elapsed,
  );
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.evaluate(() => window.testApp.paused), true);
  checks.push(
    "hidden-document event freezes clock and foreground event cannot auto-resume",
  );
  await context.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    }),
  );
  const blockedPage = await blocked.newPage();
  blockedPage.on("pageerror", (e) => errors.push(String(e)));
  await blockedPage.goto("http://127.0.0.1:5173/");
  await blockedPage.waitForSelector(".hero");
  assert.match(
    await blockedPage.locator("#notice").textContent(),
    /儲存不可用/,
  );
  await blockedPage
    .getByRole("button", { name: "任務板", exact: true })
    .click();
  await blockedPage.locator('[data-action="brief"]').first().click();
  await blockedPage.locator('[data-action="deploy"]').click();
  await blockedPage.waitForTimeout(150);
  await blockedPage.keyboard.press("Escape");
  await blockedPage.waitForSelector(".pause");
  checks.push("blocked localStorage still allows play and displays warning");
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/lifecycle.json",
    JSON.stringify({ checks, samples, errors, completed: true }, null, 2),
  );
  console.log(checks);
} finally {
  await browser.close();
}
