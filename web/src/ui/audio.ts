import type { Session } from "../game/rules";
import type { SoundName } from "../game/sound";
import type { V3 } from "../data/content";
interface Layer {
  wave: OscillatorType | "noise";
  hz: number;
  end?: number;
  gain: number;
  duration: number;
  delay?: number;
  filter?: BiquadFilterType;
}
const tone = (
  hz: number,
  end = hz,
  duration = 0.12,
  gain = 0.12,
  delay = 0,
  wave: OscillatorType = "sine",
): Layer => ({ wave, hz, end, duration, gain, delay });
const noise = (
  hz: number,
  duration: number,
  gain: number,
  delay = 0,
  filter: BiquadFilterType = "lowpass",
): Layer => ({ wave: "noise", hz, duration, gain, delay, filter });
export function soundLayers(name: SoundName): Layer[] {
  switch (name) {
    case "standard":
      return [
        noise(6800, 0.045, 0.48),
        tone(155, 35, 0.24, 0.4, 0, "triangle"),
        noise(1800, 0.28, 0.16, 0.025),
        noise(8500, 0.035, 0.08, 0.22, "highpass"),
        tone(1100, 650, 0.025, 0.045, 0.23, "square"),
      ];
    case "chili":
      return [
        noise(4300, 0.06, 0.4),
        tone(190, 42, 0.23, 0.34, 0, "triangle"),
        noise(1300, 0.3, 0.12, 0.04),
      ];
    case "coffee":
      return [
        noise(2200, 0.055, 0.32),
        tone(270, 65, 0.18, 0.3),
        noise(4800, 0.09, 0.1, 0.06, "bandpass"),
      ];
    case "marble_soda":
      return [
        noise(3500, 0.04, 0.28),
        tone(580, 110, 0.2, 0.26),
        tone(1500, 700, 0.13, 0.07),
      ];
    case "budding":
      return [
        noise(2300, 0.04, 0.27),
        tone(280, 65, 0.2, 0.25),
        tone(650, 1050, 0.15, 0.09, 0.07),
      ];
    case "empty":
      return [
        noise(5000, 0.025, 0.1, 0, "highpass"),
        tone(650, 350, 0.035, 0.06, 0, "square"),
      ];
    case "reloadOut":
      return [
        noise(5000, 0.07, 0.15, 0, "highpass"),
        tone(220, 110, 0.08, 0.1),
        noise(2500, 0.1, 0.1, 0.11),
      ];
    case "reloadIn":
      return [
        noise(2400, 0.07, 0.2),
        tone(320, 100, 0.1, 0.12),
        noise(7500, 0.035, 0.12, 0.09, "highpass"),
      ];
    case "reloadReady":
      return [
        noise(6800, 0.08, 0.2, 0, "highpass"),
        noise(2200, 0.04, 0.16, 0.11),
        tone(620, 240, 0.045, 0.1, 0.11, "triangle"),
      ];
    case "impact":
      return [noise(1100, 0.085, 0.2), tone(135, 55, 0.1, 0.17)];
    case "ricochet":
      return [
        noise(8000, 0.055, 0.18, 0, "highpass"),
        tone(2400, 550, 0.25, 0.12, 0, "triangle"),
      ];
    case "ignite":
      return [
        noise(1800, 0.6, 0.09, 0, "bandpass"),
        tone(180, 520, 0.55, 0.06),
      ];
    case "explode":
      return [
        noise(2800, 0.12, 0.4),
        tone(95, 24, 0.55, 0.42),
        noise(650, 0.65, 0.23, 0.04),
        noise(3200, 0.15, 0.09, 0.22),
      ];
    case "grow":
      return [
        tone(180, 620, 0.55, 0.12),
        tone(340, 930, 0.5, 0.075, 0.15),
        noise(3500, 0.4, 0.04, 0, "bandpass"),
      ];
    case "birth":
      return [
        tone(580, 900, 0.09, 0.12),
        tone(900, 400, 0.16, 0.12, 0.08),
        noise(1300, 0.035, 0.08),
      ];
    case "land":
    case "hop":
      return [
        tone(name === "hop" ? 120 : 170, 55, 0.1, name === "hop" ? 0.05 : 0.12),
        noise(650, 0.055, 0.06),
      ];
    case "sleep":
      return [tone(640, 380, 0.25, 0.12), tone(480, 260, 0.4, 0.08, 0.18)];
    case "stun":
      return [
        tone(290, 90, 0.12, 0.12, 0, "triangle"),
        tone(720, 430, 0.16, 0.1, 0.09),
        tone(430, 210, 0.2, 0.06, 0.2),
      ];
    case "wake":
      return [tone(330, 520, 0.15, 0.07), tone(650, 850, 0.12, 0.07, 0.12)];
    case "collect":
      return [
        tone(780, 780, 0.12, 0.13),
        tone(1170, 1170, 0.22, 0.12, 0.1),
        tone(1560, 1560, 0.2, 0.05, 0.2),
      ];
    case "warning":
    case "failure":
      return [
        tone(220, 170, 0.2, 0.11, 0, "triangle"),
        tone(160, 110, 0.32, 0.12, 0.24, "triangle"),
      ];
    case "scope":
      return [
        noise(4200, 0.07, 0.05, 0, "bandpass"),
        tone(450, 700, 0.055, 0.05),
      ];
    case "zoom":
      return [
        noise(6000, 0.025, 0.06, 0, "highpass"),
        tone(1200, 900, 0.025, 0.035),
      ];
    case "ammo":
      return [
        noise(3500, 0.055, 0.1, 0, "highpass"),
        tone(760, 510, 0.05, 0.05, 0.045),
      ];
    case "click":
      return [tone(880, 660, 0.045, 0.055), noise(5500, 0.018, 0.035)];
    case "success":
      return [
        tone(523, 523, 0.2, 0.1),
        tone(659, 659, 0.2, 0.1, 0.15),
        tone(784, 784, 0.2, 0.1, 0.3),
        tone(1046, 1046, 0.5, 0.1, 0.46),
      ];
    case "deploy":
      return [
        noise(2300, 0.12, 0.04, 0, "bandpass"),
        tone(660, 660, 0.12, 0.08),
        tone(880, 880, 0.22, 0.08),
      ];
    case "wind":
      return [noise(480, 2, 0.025)];
    case "bird":
      return [
        tone(2300, 3300, 0.07, 0.025),
        tone(2900, 1900, 0.11, 0.025, 0.13),
      ];
    case "machine":
      return [tone(65, 65, 2, 0.02, 0, "triangle"), noise(160, 2, 0.02)];
  }
}
// 聲源皆有結束時間，並在結束後釋放節點；亦可供離線音訊驗收使用。
export function synthesize(
  c: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  name: SoundName,
  gain = 1,
  pan = 0,
) {
  const sources: AudioScheduledSourceNode[] = [];
  for (const layer of soundLayers(name)) {
    const t = c.currentTime + (layer.delay ?? 0),
      duration = layer.duration;
    const source =
      layer.wave === "noise" ? c.createBufferSource() : c.createOscillator();
    const filter = c.createBiquadFilter(),
      envelope = c.createGain(),
      panner = c.createStereoPanner();
    if (layer.wave === "noise") {
      const n = source as AudioBufferSourceNode;
      n.buffer = buffer;
      n.loop = true;
      filter.type = layer.filter ?? "lowpass";
      filter.frequency.value = layer.hz;
    } else {
      const osc = source as OscillatorNode;
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(layer.hz, t);
      osc.frequency.exponentialRampToValueAtTime(
        layer.end ?? layer.hz,
        t + duration,
      );
      filter.type = "lowpass";
      filter.frequency.value = 15000;
    }
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(
      layer.gain * gain,
      t + Math.min(0.008, duration * 0.15),
    );
    envelope.gain.exponentialRampToValueAtTime(0.00001, t + duration);
    envelope.gain.setValueAtTime(0, t + duration + 0.005);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source
      .connect(filter)
      .connect(envelope)
      .connect(panner)
      .connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      panner.disconnect();
    };
    source.start(t);
    source.stop(t + duration + 0.01);
    sources.push(source);
  }
  return sources;
}
export function noiseBuffer(c: BaseAudioContext) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
    data = b.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed / 2147483648 - 1;
  }
  return b;
}
type Camera = {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
};
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private buffer?: AudioBuffer;
  private voices = new Set<AudioScheduledSourceNode>();
  private ambientVoices = new Set<AudioScheduledSourceNode>();
  private last = new Map<SoundName, number>();
  private ambience = 0;
  private footsteps = 0;
  volume = 0.65;
  muted = false;
  constructor() {
    try {
      const p = JSON.parse(
        localStorage.getItem("highground.audio.v1") ?? "null",
      );
      if (p) {
        if (Number.isFinite(p.volume))
          this.volume = Math.max(0, Math.min(1, p.volume));
        this.muted = p.muted === true;
      }
    } catch {}
  }
  enable() {
    try {
      if (!this.context) {
        const c = (this.context = new AudioContext());
        this.buffer = noiseBuffer(c);
        this.master = c.createGain();
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.knee.value = 10;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.15;
        limiter.connect(c.destination);
        this.master.connect(limiter);
        this.applyVolume();
      }
      void this.context.resume().catch(() => {});
    } catch {}
  }
  private applyVolume() {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.025,
      );
  }
  settings(volume = this.volume, muted = this.muted) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    this.applyVolume();
    if (muted) this.stop();
    try {
      localStorage.setItem(
        "highground.audio.v1",
        JSON.stringify({ volume: this.volume, muted }),
      );
    } catch {}
  }
  play(name: SoundName, pos?: V3, camera?: Camera) {
    const c = this.context;
    if (
      !c ||
      c.state !== "running" ||
      !this.master ||
      !this.buffer ||
      this.muted ||
      !this.volume
    )
      return;
    const now = c.currentTime;
    if (
      now - (this.last.get(name) ?? -100) <
      (name === "explode" ? 0.08 : 0.04)
    )
      return;
    if (this.voices.size + soundLayers(name).length > 96) return;
    this.last.set(name, now);
    let gain = 1,
      pan = 0;
    if (pos && camera) {
      const dx = pos[0] - camera.position.x,
        dz = pos[2] - camera.position.z;
      const distance = Math.hypot(dx, dz, pos[1] - camera.position.y);
      gain = 1 / (1 + distance / 35);
      pan =
        (dx * Math.cos(camera.rotation.y) - dz * Math.sin(camera.rotation.y)) /
        Math.max(10, distance);
    }
    for (const s of synthesize(c, this.master, this.buffer, name, gain, pan)) {
      const ended = s.onended;
      s.onended = (e) => {
        ended?.call(s, e);
        this.voices.delete(s);
        this.ambientVoices.delete(s);
      };
      this.voices.add(s);
      if (["wind", "bird", "machine", "hop"].includes(name))
        this.ambientVoices.add(s);
    }
  }
  flush(s: Session, camera: Camera) {
    for (const e of s.drainSounds()) this.play(e.name, e.pos, camera);
  }
  update(s: Session, camera: Camera) {
    this.flush(s, camera);
    if (s.elapsed >= this.ambience) {
      this.ambience = s.elapsed + 1.8;
      this.play(
        s.mission.map === "factory" || s.mission.map === "city"
          ? "machine"
          : "wind",
      );
      if (
        ["park", "rural", "residential"].includes(s.mission.map) &&
        Math.floor(s.elapsed) % 7 < 2
      )
        this.play("bird");
    }
    if (s.elapsed >= this.footsteps) {
      this.footsteps = s.elapsed + 0.3;
      const near = s.enemies.find(
        (a) =>
          ["moving", "frightened"].includes(a.state) &&
          Math.hypot(
            a.pos[0] - camera.position.x,
            a.pos[2] - camera.position.z,
          ) < 85,
      );
      if (near) this.play("hop", near.pos, camera);
    }
  }
  stopAmbience() {
    for (const s of this.ambientVoices) {
      try {
        s.stop();
      } catch {}
      this.voices.delete(s);
    }
    this.ambientVoices.clear();
    this.ambience = 0;
    this.footsteps = 0;
  }
  stop() {
    for (const s of this.voices) {
      try {
        s.stop();
      } catch {}
    }
    this.voices.clear();
    this.ambientVoices.clear();
    this.last.clear();
    this.ambience = 0;
    this.footsteps = 0;
  }
  metrics() {
    return {
      activeVoices: this.voices.size,
      state: this.context?.state ?? "unavailable",
      muted: this.muted,
      volume: this.volume,
    };
  }
}
