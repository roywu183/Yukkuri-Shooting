import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const channel = process.env.BROWSER_CHANNEL ?? "chrome",
  out = "validation/audio";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel, headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.a = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
    window.cues = [];
    const play = window.a.audio.play.bind(window.a.audio);
    window.a.audio.play = (name, ...rest) => {
      window.cues.push(name);
      return play(name, ...rest);
    };
  });
  const rendered = await page.evaluate(async () => {
    const { synthesize, noiseBuffer, soundLayers } =
      await import("/src/ui/audio.ts");
    const names = [
      "standard",
      "chili",
      "coffee",
      "marble_soda",
      "budding",
      "impact",
      "ricochet",
      "empty",
      "reloadOut",
      "reloadIn",
      "reloadReady",
      "ignite",
      "explode",
      "grow",
      "birth",
      "land",
      "sleep",
      "stun",
      "wake",
      "collect",
      "warning",
      "scope",
      "zoom",
      "ammo",
      "click",
      "success",
      "failure",
      "deploy",
      "hop",
      "wind",
      "bird",
      "machine",
    ];
    const stats = [],
      samples = [];
    for (const name of names) {
      const layers = soundLayers(name),
        duration =
          Math.max(...layers.map((l) => (l.delay ?? 0) + l.duration)) + 0.15;
      const c = new OfflineAudioContext(2, Math.ceil(22050 * duration), 22050);
      synthesize(c, c.destination, noiseBuffer(c), name);
      const b = await c.startRendering(),
        d = b.getChannelData(0);
      let peak = 0,
        energy = 0;
      for (const v of d) {
        if (!Number.isFinite(v)) throw Error("nonfinite audio");
        peak = Math.max(peak, Math.abs(v));
        energy += v * v;
      }
      stats.push({
        name,
        peak,
        rms: Math.sqrt(energy / d.length),
        tail: Math.max(...d.slice(-100)),
        duration,
      });
      for (const v of d)
        samples.push(Math.max(-32768, Math.min(32767, Math.round(v * 32767))));
      for (let i = 0; i < 5512; i++) samples.push(0);
    }
    const pcm = new Uint8Array(samples.length * 2),
      view = new DataView(pcm.buffer);
    samples.forEach((v, i) => view.setInt16(i * 2, v, true));
    let str = "";
    for (let i = 0; i < pcm.length; i += 8192)
      str += String.fromCharCode(...pcm.subarray(i, i + 8192));
    return { stats, pcm: btoa(str) };
  });
  for (const r of rendered.stats) {
    assert.ok(r.peak > 0.0001 && r.peak < 1, r.name);
    assert.ok(Math.abs(r.tail) < 0.0001, r.name + " tail");
  }
  if (channel === "chrome") {
    const pcm = Buffer.from(rendered.pcm, "base64"),
      header = Buffer.alloc(44);
    header.write("RIFF");
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVEfmt ", 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(22050, 24);
    header.writeUInt32LE(44100, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    writeFileSync(`${out}/sound-preview.wav`, Buffer.concat([header, pcm]));
  }
  await page.getByRole("button", { name: "任務板", exact: true }).click();
  await page.locator('[data-action="brief"]').first().click();
  await page.locator('[data-action="deploy"]').click();
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(2300);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.mouse.wheel(0, -120);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause");
  const paused = await page.evaluate(() => window.a.audio.metrics());
  assert.equal(paused.activeVoices, 0);
  const cues = await page.evaluate(() => window.cues);
  for (const name of [
    "standard",
    "reloadOut",
    "reloadIn",
    "reloadReady",
    "scope",
    "zoom",
    "hop",
  ])
    assert.ok(cues.includes(name), name + " missing");
  await page.getByLabel("音效音量").fill("37");
  await page.getByLabel("切換靜音").click();
  assert.equal(await page.evaluate(() => window.a.audio.metrics().muted), true);
  await page.screenshot({ path: `${out}/${channel}-controls.png` });
  await page.reload();
  await page.waitForSelector(".hero");
  await page.evaluate(async () => {
    window.a = (
      await import(document.querySelector('script[src*="/src/main.ts"]').src)
    ).app;
  });
  const saved = await page.evaluate(() => window.a.audio.metrics());
  assert.equal(saved.volume, 0.37);
  assert.equal(saved.muted, true);
  await page.getByLabel("切換靜音").click();
  await page.waitForTimeout(200);
  const stress = await page.evaluate(() => {
    const a = window.a.audio;
    for (let i = 0; i < 1000; i++) a.play("explode");
    a.play("standard");
    a.play("wind");
    const before = a.metrics();
    a.stopAmbience();
    const after = a.metrics();
    return { before, after };
  });
  assert.ok(stress.before.activeVoices <= 96);
  assert.ok(stress.after.activeVoices > 0);
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(() => window.a.audio.metrics().activeVoices),
    0,
  );
  assert.deepEqual(errors, []);
  const finalShot = await page.evaluate(async () => {
    const a = window.a,
      { Session } = await import("/src/game/rules.ts"),
      { missionById } = await import("/src/data/content.ts");
    const s = new Session(missionById("park_01"), "campaign", a.store.value, 7);
    s.enemies = s.enemies.slice(0, 1);
    s.stats.kills = s.mission.max_enemy_count - 1;
    a.session = s;
    a.audio.stop();
    s.fire(s.enemies[0].id); s.tick(1.1);
    a.audio.flush(s, a.view.camera);
    const before = a.audio.metrics().activeVoices;
    a.showResult();
    return { before, after: a.audio.metrics().activeVoices };
  });
  assert.ok(finalShot.before > 0);
  assert.ok(finalShot.after >= finalShot.before);
  writeFileSync(
    `${out}/${channel}.json`,
    JSON.stringify(
      {
        completed: true,
        rendered: rendered.stats,
        cues,
        paused,
        saved,
        stress,
        finalShot,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    channel +
      ": 32 audio renders, real controls, reload timing, pause/mute/persistence and voice cleanup passed",
  );
} finally {
  await browser.close();
}
