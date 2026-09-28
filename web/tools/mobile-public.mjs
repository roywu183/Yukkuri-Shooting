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
    ["portrait", { width: 1280, height: 720 }, "desktop-agent-no-touch", { hasTouch: false }],
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
    assert.equal(await page.locator("html").getAttribute("data-device-detection"), "auto");
    if (!device.hasTouch) {
      await page.locator(".hero").waitFor();
      assert.equal(await page.locator(".orientation-choice").count(), 0);
      assert.equal(await page.locator("#app").evaluate(el => el.classList.contains("mobile")), false);
      await page.screenshot({ path: `${directory}/${label}-home.png`, fullPage: true });
      await page.locator("[data-action=campaign]").first().click();
      await page.locator("[data-action=brief]").first().click();
      await page.locator("[data-action=deploy]").click();
      await page.waitForFunction(() => !!document.pointerLockElement);
      assert.equal(await page.locator(".touch-controls").isVisible(), false);
      await page.screenshot({ path: `${directory}/${label}-play.png` });
      await page.keyboard.press("Escape");
      await page.locator(".pause").waitFor();
      await page.locator("[data-action=leave]").click();
      await page.locator(".result").waitFor();
      assert.deepEqual(errors, []);
      results.push({ url, label, mobile: false, desktopPointerLock: true, errors, passed: true });
      await context.close();
      continue;
    }
    await page.locator(".orientation-choice").waitFor();
    for (const [locale, title, portrait, landscape, hint] of [
      ["zh-Hans", "手机游戏方向", "直向游戏", "横向游戏", "拖曳画面瞄准，按钮射击；进入勤务时请转至所选方向。"],
      ["ja", "スマートフォンの画面方向", "縦向きでプレイ", "横向きでプレイ", "画面をドラッグして照準を合わせ、ボタンで発射します。任務を始めるときは選んだ向きに端末を回してください。"],
      ["zh-Hant", "手機遊戲方向", "直向遊戲", "橫向遊戲", "拖曳畫面瞄準，按鈕射擊；進入勤務時請轉至所選方向。"],
    ]) {
      await press(page.locator(`[data-action=locale][data-id="${locale}"]`));
      await page.waitForFunction(title => document.querySelector(".orientation-choice b")?.textContent === title, title);
      assert.equal(await page.locator("[data-action=orientation][data-id=portrait]").textContent(), portrait);
      assert.equal(await page.locator("[data-action=orientation][data-id=landscape]").textContent(), landscape);
      assert.equal(await page.locator(".orientation-choice small").textContent(), hint);
      if (label === "android-portrait") await page.screenshot({ path: `${directory}/android-${locale}.png`, fullPage: true });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
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
    results.push({ url, orientation, label, mobile: true, languages: ["zh-Hant", "zh-Hans", "ja"], choiceInFirstScreen: true, status: response.status(), errors, passed: true });
    await context.close();
  }
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
  const site = new URL(url).pathname.includes("Yukkuri-Shooting-Mobile") ? "mobile" : "original";
  writeFileSync(`${directory}/results-${site}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
