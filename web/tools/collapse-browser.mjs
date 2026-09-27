import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "validation/collapse";
mkdirSync(out, { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? "chrome";
const browser = await chromium.launch({ channel, headless: true }),
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  const report = await page.evaluate(async () => {
    const a = (
        await import(document.querySelector('script[src*="/src/main.ts"]').src)
      ).app,
      T = await import("/node_modules/three/build/three.module.js");
    const { Session } = await import("/src/game/rules.ts"),
      { missionById, ammoOrder } = await import("/src/data/content.ts");
    const s = new Session(missionById("park_01"), "free", a.store.value, 7);
    s.availableAmmo = ammoOrder;
    const victim = s.enemies[0];
    s.fire(victim.id);
    const panic = s.enemies.filter((e) => e.state === "frightened").length;
    s.cooldown = 0;
    s.ammo = "coffee";
    const poison = s.enemies.find((e) => e.state !== "disposed");
    s.fire(poison.id);
    for (let i = 0; i < 2000; i++) s.tick(1 / 60);
    const retained =
      s.enemies.includes(victim) &&
      s.enemies.includes(poison) &&
      poison.deathCause === "poison";
    a.preview = undefined;
    a.ui.innerHTML = "";
    a.soundControls.style.display = "none";
    document.querySelector("#vignette").style.display = "none";
    const scene = new T.Scene();
    scene.background = new T.Color("#eee9dd");
    scene.add(new T.HemisphereLight(0xffffff, 0x777777, 2.5));
    const l = new T.DirectionalLight(0xffffff, 2);
    l.position.set(-3, 6, 8);
    scene.add(l);
    const camera = new T.OrthographicCamera(-6.4, 6.4, 3.6, -3.6, 0.1, 100);
    camera.position.set(0, 2.4, 15);
    camera.lookAt(0, 2.4, 0);
    const states = Array(6).fill("disposed");
    const colors = [];
    states.forEach((state, i) => {
      const m = a.view.lib.create("reimu");
      m.root.position.set(((i%3)-1)*3.7,i<3?3:0,0);
      m.update(1, state, i>=3 ? "poison" : "standard",[0,.5,1][i%3]);
      scene.add(m.root);
      colors.push({ state, scale: m.body.scale.toArray() });
    });
    a.view.render = () => a.view.renderer.render(scene, camera);
    return { panic, retained, colors };
  });
  assert.ok(report.panic > 3);
  assert.ok(report.retained);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${channel}.png` });
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/${channel}.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(channel + "：恐慌、中毒、兩種屍體畫面及屍體保留通過");
} finally {
  await browser.close();
}
