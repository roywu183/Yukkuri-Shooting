import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
  });
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(250);
  // Use the actual browser pointer-lock error path and an explicit user retry.
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForSelector(".pause");
  assert.ok(await page.locator('[data-action="resume"]').isVisible());
  checks.push("pointer unlock pauses");
  await page.evaluate(() => {
    window.savedLock = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = () =>
      Promise.reject(new Error("denied"));
  });
  await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator(".pause").isVisible());
  checks.push("pointer-lock rejection recoverable");
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.requestPointerLock = window.savedLock;
  });
  await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(100);
  // A real foreground change, not a synthetic pause method.
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(150);
  await page.bringToFront();
  await page.waitForTimeout(150);
  let paused = await page.evaluate(async () => {
    const app = window.testApp;
    return app.paused;
  });
  if (!paused) {
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    paused = await page.evaluate(async () => {
      const app = window.testApp;
      return app.paused;
    });
  }
  assert.equal(paused, true);
  checks.push("window blur pauses");
  await other.close();
  // Controlled browser quota error; production transaction and UI remain real.
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("highground.web"))
        throw new DOMException("full", "QuotaExceededError");
      return window.originalSetItem.call(this, k, v);
    };
  });
  await page.locator('[data-action="leave"]').click();
  await page.waitForSelector(".result");
  assert.equal(
    await page.locator('.result [data-action="campaign"]').count(),
    0,
  );
  assert.equal(await page.locator('[data-action="retry-save"]').count(), 1);
  assert.equal(await page.locator('[data-action="discard-result"]').count(), 1);
  const runId = await page.evaluate(async () => {
    const app = window.testApp;
    await app.action("home");
    return app.session?.result?.runId;
  });
  assert.ok(runId);
  checks.push("failed settlement cannot silently discard result");
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await page.locator('[data-action="retry-save"]').click();
  assert.ok(
    await page
      .locator(".save-status")
      .textContent()
      .then((t) => t.includes("已保存")),
  );
  checks.push("failed settlement retry succeeds");
  await page.locator('.result [data-action="campaign"]').click();
  // Saved fixture enables a fully upgraded scope, without shipping a debug mode.
  await page.evaluate(async () => {
    const app = window.testApp;
    app.store.value.upgrades.scope_ticks_1 = 1;
    app.store.save();
  });
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(150);
  await page.mouse.click(960, 540, { button: "right" });
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".range-mark").count(), 15);
  assert.ok(await page.locator('.range-mark[data-range="20"]').count());
  checks.push("upgraded scope has 20 m projected marks");
  // Place an actor behind a real world collider and fire through the real renderer raycast.
  const occlusion = await page.evaluate(async () => {
    const app = window.testApp;
    const T = await import("/node_modules/three/build/three.module.js");
    const s = app.session,
      view = app.view;
    const blocker = view.world.colliders.find(
      (m) => m.position.x === -32 && m.geometry.type === "CylinderGeometry",
    );
    const center = blocker.position.clone();
    const direction = center.clone().sub(view.camera.position).normalize();
    const point = center.clone().addScaledVector(direction, 1);
    const a = s.enemies[0];
    a.pos = [point.x, point.y - 0.95, point.z];
    a.state = "sleep";
    a.statusTime = 30;
    s.mission = { ...s.mission, wind: [0, 0, 0] };
    view.sync(s, 0, false);
    view.camera.lookAt(point);
    view.pitch = view.camera.rotation.x;
    view.yaw = view.camera.rotation.y;
    view.scene.updateMatrixWorld(true);
    const before = s.stats.kills;
    view.shoot(s);
    return { before, after: s.stats.kills, collateral: s.stats.collateral };
  });
  assert.equal(occlusion.after, occlusion.before);
  assert.ok(occlusion.collateral > 0);
  checks.push("real world occluder blocks shot");
  await page.keyboard.press("Escape");
  await page.locator('[data-action="leave"]').click();
  await page.locator('.result [data-action="campaign"]').click();
  // Recover a valid backup while preserving the invalid original in real localStorage.
  await page.evaluate(() => {
    const raw = localStorage.getItem("highground.web.v1");
    localStorage.setItem("highground.web.v1.backup", raw);
    localStorage.setItem("highground.web.v1", "corrupt-original");
  });
  await page.reload();
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.testApp = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
  });
  const recovery = await page.evaluate(async () => {
    const app = window.testApp;
    return {
      warning: app.store.warning,
      corrupt: Object.keys(localStorage)
        .filter((k) => k.includes(".corrupt."))
        .map((k) => localStorage.getItem(k)),
      level: app.store.value.upgrades.scope_ticks_1,
    };
  });
  assert.ok(recovery.warning.includes("備份"));
  assert.ok(recovery.corrupt.includes("corrupt-original"));
  assert.equal(recovery.level, 1);
  checks.push("corrupt save recovered and original retained");
  assert.deepEqual(errors, []);
  writeFileSync(
    "test-results/edge-cases.json",
    JSON.stringify({ checks, errors, completed: true }, null, 2),
  );
  console.log(checks);
} catch (e) {
  await page
    .screenshot({ path: "test-results/edge-cases-failure.png" })
    .catch(() => {});
  writeFileSync(
    "test-results/edge-cases-failure.json",
    JSON.stringify({ error: String(e), checks, errors }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
