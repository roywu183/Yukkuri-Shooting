import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const directory = "validation/mobile";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
  headless: true,
});
const results = [];
try {
  for (const [orientation, viewport, label] of [
    ["portrait", { width: 390, height: 844 }, "portrait"],
    ["landscape", { width: 844, height: 390 }, "landscape"],
    ["portrait", { width: 320, height: 568 }, "small-portrait"],
    ["landscape", { width: 667, height: 375 }, "small-landscape"],
  ]) {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      viewport,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // Exercise the Safari-style fallback, where native locking is unavailable.
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = async () => {
        throw Error("unsupported");
      };
    });
    const read = () =>
      page.evaluate(async () => {
        const { app } = await import("/src/main.ts");
        return {
          mobile: app.mobile,
          paused: app.paused,
          yaw: app.view.yaw,
          scope: app.view.scope,
          zoom: app.view.zoom,
          shots: app.session?.stats.shots,
          rounds: app.session?.rounds,
          reload: app.session?.reloadLeft,
          elapsed: app.session?.elapsed,
          ammo: app.session?.ammo,
          collected: app.session?.collected,
          drops: app.session?.drops.length,
        };
      });
    await page.goto("http://127.0.0.1:5173/");
    await page.locator(".orientation-choice").waitFor();
    assert.equal((await read()).mobile, true);
    await page
      .locator(`[data-action=orientation][data-id=${orientation}]`)
      .tap();
    assert.equal(
      await page
        .locator(`[data-action=orientation][data-id=${orientation}]`)
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `${directory}/${label}-home.png`,
      fullPage: true,
    });
    await page.locator("[data-action=campaign]").first().tap();
    await page.locator("[data-action=brief]").first().tap();
    assert.match(await page.locator(".controls").innerText(), /拖曳/);
    await page.locator("[data-action=deploy]").tap();
    assert.equal((await read()).paused, false);
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
    const touch = await context.newCDPSession(page);
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const yaw = (await read()).yaw;
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...center, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: center.x + 40, y: center.y, id: 1 }],
    });
    // A second finger can fire while the first finger continues aiming.
    const fire = await page.locator("[data-touch=fire]").boundingBox();
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: center.x + 40, y: center.y, id: 1 },
        { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 },
      ],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.notEqual((await read()).yaw, yaw);
    assert.equal((await read()).shots, 1);
    const canceledYaw = (await read()).yaw;
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...center, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...center, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: center.x + 20, y: center.y, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.notEqual((await read()).yaw, canceledYaw, "取消觸控後可重新瞄準");
    await page.locator("[data-touch=reload]").tap();
    assert.ok((await read()).reload > 0);
    await page.locator("[data-touch=scope]").tap();
    await page.locator("[data-touch=zoom-in]").tap();
    assert.equal((await read()).scope, true);
    assert.equal((await read()).zoom, 1);
    await page.locator("[data-touch=zoom-out]").tap();
    assert.equal((await read()).zoom, 0);
    assert.equal(
      await page.locator('[data-touch=ammo][data-index="1"]').isDisabled(),
      true,
    );
    await page.evaluate(async () => {
      const { app } = await import("/src/main.ts");
      app.session.availableAmmo = [
        "standard",
        "chili",
        "coffee",
        "marble_soda",
        "budding",
      ];
      app.updateHud();
    });
    for (const [index, ammo] of [
      [1, "chili"],
      [2, "coffee"],
      [3, "marble_soda"],
      [4, "budding"],
    ]) {
      await page.locator(`[data-touch=ammo][data-index="${index}"]`).tap();
      assert.equal((await read()).ammo, ammo);
      assert.equal(
        await page
          .locator(`[data-touch=ammo][data-index="${index}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
    }
    await page.locator('[data-touch=ammo][data-index="0"]').tap();
    await page.evaluate(async () => {
      const { app } = await import("/src/main.ts");
      app.session.mode = "free";
      app.session.drops = [
        {
          id: 999,
          pos: [0, 0, 0],
          species: "reimu",
          hat: "common_hat",
          age: 0,
        },
      ];
      app.session.collected = {};
      app.updateHud();
    });
    await page.locator("[data-touch=collect]").tap();
    assert.equal((await read()).drops, 0);
    assert.equal((await read()).collected.common_hat, 1);
    await page.screenshot({ path: `${directory}/${label}-play.png` });
    const layout = await page.evaluate(() => {
      const buttons = [
        ...document.querySelectorAll(
          ".touch-controls button:not([hidden]):not(:disabled)",
        ),
      ];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: buttons.map((b) => {
          const r = b.getBoundingClientRect();
          return {
            label: b.textContent,
            visible:
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= innerWidth &&
              r.bottom <= innerHeight,
            reachable: b.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            ),
            height: r.height,
          };
        }),
      };
    });
    assert.equal(layout.overflow, false);
    assert.ok(
      layout.buttons.every((b) => b.visible && b.reachable && b.height >= 44),
      JSON.stringify(layout),
    );
    await page.locator("[data-touch=pause]").tap();
    const time = (await read()).elapsed;
    await page.waitForTimeout(250);
    assert.equal((await read()).elapsed, time);
    await page.locator("[data-action=resume]").tap();
    assert.equal((await read()).paused, false);
    await page.setViewportSize(
      orientation === "portrait"
        ? { width: 844, height: 390 }
        : { width: 390, height: 844 },
    );
    await page.locator(".rotation-prompt:not([hidden])").waitFor();
    assert.equal((await read()).paused, true);
    await page.locator(".rotation-prompt button").tap();
    await page.locator("[data-action=resume]").tap();
    assert.equal((await read()).paused, false);
    await page.locator("[data-touch=pause]").tap();
    await page.locator("[data-action=leave]").tap();
    await page.locator(".result").waitFor();
    assert.equal(await page.locator(".touch-controls").isVisible(), false);
    for (const menu of [
      "home",
      "campaign",
      "free",
      "workshop",
      "community",
      "gallery",
    ]) {
      await page.evaluate(async (menu) => {
        const { app } = await import("/src/main.ts");
        await app.action(menu);
      }, menu);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${label} ${menu} 不應水平溢出`,
      );
    }
    await page.evaluate(async () => {
      const { app } = await import("/src/main.ts");
      await app.action("home");
    });
    const saved = await page.evaluate(() =>
      localStorage.getItem("highground.web.orientation"),
    );
    await page.reload();
    await page.locator(".orientation-choice").waitFor();
    assert.equal(
      await page
        .locator(`[data-action=orientation][data-id=${saved}]`)
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.deepEqual(errors, []);
    results.push({ orientation, viewport, errors, layout, passed: true });
    await context.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.locator(".hero").waitFor();
  assert.equal(await page.locator(".orientation-choice").count(), 0);
  results.push({ desktop: true, passed: true });
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
