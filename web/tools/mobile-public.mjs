import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.GAME_URL ?? "https://roywu183.github.io/Yukkuri-Shooting-Mobile/";
const directory = "validation/mobile-public";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [orientation, viewport, label, device] of [
    ["portrait", { width: 390, height: 844 }, "portrait", devices["iPhone 13"]],
    ["landscape", { width: 844, height: 390 }, "landscape", devices["iPhone 13"]],
    ["portrait", { width: 393, height: 851 }, "android-portrait", devices["Pixel 5"]],
    ["landscape", { width: 851, height: 393 }, "android-landscape", devices["Pixel 5"]],
    ["portrait", { width: 390, height: 844 }, "desktop-agent-touch", { hasTouch: true }],
    ["portrait", { width: 390, height: 844 }, "desktop-agent-no-touch", { hasTouch: false }],
  ]) {
    const context = await browser.newContext({ ...device, viewport });
    const page = await context.newPage();
    const press = (locator) => device.hasTouch ? locator.tap() : locator.click();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = async () => { throw Error("unsupported"); };
    });
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("html").getAttribute("data-mobile-edition"), "true");
    await page.locator(".orientation-choice").waitFor();
    const choice = await page.locator(".orientation-choice").boundingBox();
    assert.ok(choice.y >= 0 && choice.y + choice.height <= viewport.height, `${label} 方向選擇應在首頁第一屏內`);
    await press(page.locator(`[data-action=orientation][data-id=${orientation}]`));
    await page.screenshot({ path: `${directory}/${label}-home.png`, fullPage: true });
    await press(page.locator("[data-action=campaign]").first());
    await press(page.locator("[data-action=brief]").first());
    await press(page.locator("[data-action=deploy]"));
    await page.locator(".touch-controls:not([hidden])").waitFor();
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
    const rounds = Number(await page.locator(".rounds b").textContent());
    await press(page.locator("[data-touch=fire]"));
    assert.equal(Number(await page.locator(".rounds b").textContent()), rounds - 1);
    await press(page.locator("[data-touch=scope]"));
    await page.locator(".scope-ring").waitFor();
    await press(page.locator("[data-touch=zoom-in]"));
    await page.screenshot({ path: `${directory}/${label}-play.png` });
    await press(page.locator("[data-touch=pause]"));
    await page.locator(".pause").waitFor();
    await press(page.locator("[data-action=resume]"));
    await page.locator(".touch-controls:not([hidden])").waitFor();
    await press(page.locator("[data-touch=pause]"));
    await press(page.locator("[data-action=leave]"));
    await page.locator(".result").waitFor();
    assert.match(await page.locator(".save-status").textContent(), /已保存/);
    assert.deepEqual(errors, []);
    results.push({ url, orientation, label, choiceInFirstScreen: true, status: response.status(), errors, passed: true });
    await context.close();
  }
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
