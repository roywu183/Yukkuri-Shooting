import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.GAME_URL ?? "https://roywu183.github.io/Yukkuri-Shooting-Mobile/";
const directory = "validation/mobile-public";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [orientation, viewport] of [
    ["portrait", { width: 390, height: 844 }],
    ["landscape", { width: 844, height: 390 }],
  ]) {
    const context = await browser.newContext({ ...devices["iPhone 13"], viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = async () => { throw Error("unsupported"); };
    });
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    await page.locator(".orientation-choice").waitFor();
    await page.locator(`[data-action=orientation][data-id=${orientation}]`).tap();
    await page.screenshot({ path: `${directory}/${orientation}-home.png`, fullPage: true });
    await page.locator("[data-action=campaign]").first().tap();
    await page.locator("[data-action=brief]").first().tap();
    await page.locator("[data-action=deploy]").tap();
    await page.locator(".touch-controls:not([hidden])").waitFor();
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
    const rounds = Number(await page.locator(".rounds b").textContent());
    await page.locator("[data-touch=fire]").tap();
    assert.equal(Number(await page.locator(".rounds b").textContent()), rounds - 1);
    await page.locator("[data-touch=scope]").tap();
    await page.locator(".scope-ring").waitFor();
    await page.locator("[data-touch=zoom-in]").tap();
    await page.screenshot({ path: `${directory}/${orientation}-play.png` });
    await page.locator("[data-touch=pause]").tap();
    await page.locator(".pause").waitFor();
    await page.locator("[data-action=resume]").tap();
    await page.locator(".touch-controls:not([hidden])").waitFor();
    await page.locator("[data-touch=pause]").tap();
    await page.locator("[data-action=leave]").tap();
    await page.locator(".result").waitFor();
    assert.match(await page.locator(".save-status").textContent(), /已保存/);
    assert.deepEqual(errors, []);
    results.push({ url, orientation, status: response.status(), errors, passed: true });
    await context.close();
  }
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
