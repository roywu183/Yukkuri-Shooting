import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const channel = process.env.BROWSER_CHANNEL ?? "chrome",
  out = "validation/family-dialogue";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel, headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  assert.equal(await page.evaluate(() => !!document.pointerLockElement), true);
  const setup = await page.evaluate(async () => {
    const a = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
    const { Session } = await import("/src/game/rules.ts"),
      { missionById } = await import("/src/data/content.ts");
    const s = new Session(missionById("park_01"), "free", a.store.value, 1);
    a.session = s;
    a.view.setMap(s.mission.map);
    const family = [...s.families.values()][0],
      members = family.members.map((id) => s.enemies.find((x) => x.id === id));
    const before = members.map((x) => [...x.pos]);
    for (let i = 0; i < 180; i++) s.tick(1 / 60);
    const offsets = members.map((x, i) => [
      x.pos[0] - members[0].pos[0] - (before[i][0] - before[0][0]),
      x.pos[2] - members[0].pos[2] - (before[i][2] - before[0][2]),
    ]);
    // Freeze simulation for reproducible visual fixtures; production frame/render/UI remain active.
    window.advanceFamily = s.tick.bind(s);
    s.tick = () => {};
    const center = members.reduce(
      (v, x) => v.map((n, i) => n + x.pos[i] / 4),
      [0, 0, 0],
    );
    a.view.camera.position.set(center[0], center[1] + 5, center[2] + 15);
    a.view.camera.lookAt(center[0], center[1] + 1, center[2]);
    a.view.pitch = a.view.camera.rotation.x;
    a.view.yaw = a.view.camera.rotation.y;
    s.speeches = [];
    members.forEach((x) => s.say(x, "idle"));
    window.familyApp = a;
    window.familyMembers = members;
    return {
      offsets,
      moved: members[0].pos[0] !== before[0][0],
      ages: members.map((x) => x.juvenile),
    };
  });
  assert.ok(setup.moved);
  assert.deepEqual(setup.ages, [false, false, true, true]);
  assert.ok(setup.offsets.flat().every((x) => Math.abs(x) < 1e-6));
  await page.waitForTimeout(250);
  assert.ok((await page.locator(".speech-bubble:visible").count()) >= 2);
  await page.screenshot({ path: `${out}/${channel}-family.png` });
  const hit = await page.evaluate(() => {
    const s = window.familyApp.session,
      m = window.familyMembers;
    s.fire(m[2].id);
    return {
      split: m.every((x) => x.familyId === undefined),
      panic: m.filter((x) => x !== m[2]).every((x) => x.state === "frightened"),
      speeches: s.speeches.map((x) => ({ event: x.event, text: x.text })),
    };
  });
  assert.ok(hit.split && hit.panic);
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".speech-bubble.death:visible").count(), 1);
  assert.ok((await page.locator(".speech-bubble.witness:visible").count()) > 0);
  await page.screenshot({ path: `${out}/${channel}-panic.png` });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause");
  assert.equal(await page.locator(".speech-bubble:visible").count(), 0);
  await page.locator('[data-action="resume"]').click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200);
  const bounds = await page
    .locator(".speech-bubble:visible")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const b = n.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      }),
    );
  assert.ok(bounds.length > 0 && bounds.length <= 5);
  assert.ok(
    bounds.every(
      (b) => b.left >= 0 && b.right <= 1280 && b.top >= 0 && b.bottom <= 720,
    ),
  );
  await page.evaluate(() => {
    for (let i = 0; i < 600; i++) window.advanceFamily(1 / 60);
    window.familyApp.session.speeches = [];
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".speech-bubble").count(), 0);
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/${channel}.json`,
    JSON.stringify(
      {
        setup,
        hit,
        bounds,
        errors,
        fixture: "固定種子、手動步進及近距離相機；真實介面進場、暫停與恢復",
      },
      null,
      2,
    ),
  );
  console.log(
    `${channel} 家庭同行、驚嚇解散、三類台詞、暫停恢復、縮放與氣泡清理通過`,
  );
} finally {
  await browser.close();
}
