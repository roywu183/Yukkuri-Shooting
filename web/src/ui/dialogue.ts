import * as T from "three";
import type { Session } from "../game/rules";
export class DialogueView {
  private nodes = new Map<number, HTMLDivElement>();
  readonly root = document.createElement("div");
  private point = new T.Vector3();
  constructor(parent: HTMLElement) {
    this.root.className = "dialogue-layer";
    this.root.setAttribute("aria-label", "油庫里台詞");
    parent.append(this.root);
  }
  update(s: Session | undefined, camera: T.Camera, visible: boolean) {
    this.root.hidden = !visible;
    if (!s || !visible) {
      this.root.replaceChildren();
      this.nodes.clear();
      return;
    }
    const w = innerWidth,
      h = innerHeight,
      occupied: { x: number; y: number; width: number; height: number }[] = [];
    const priority = { death: 0, witness: 1, idle: 2 };
    const speeches = [...s.speeches]
      .filter((x) => x.until > s.elapsed)
      .sort((a, b) => priority[a.event] - priority[b.event] || b.id - a.id);
    const shown = new Set<number>();
    for (const speech of speeches) {
      if (shown.size >= 5) break;
      const actor = s.enemies.find((a) => a.id === speech.actorId),
        pos = actor?.pos ?? speech.pos;
      this.point
        .set(
          pos[0],
          pos[1] +
            (actor?.state === "disposed" ? 0.7 : 2.4) * (actor?.scale ?? 1),
          pos[2],
        )
        .project(camera);
      if (
        this.point.z < -1 ||
        this.point.z > 1 ||
        Math.abs(this.point.x) > 1.05 ||
        Math.abs(this.point.y) > 1.05
      )
        continue;
      let node = this.nodes.get(speech.id);
      if (!node) {
        node = document.createElement("div");
        node.className = `speech-bubble ${speech.event}`;
        node.textContent = speech.text;
        this.root.append(node);
        this.nodes.set(speech.id, node);
      }
      const width = node.offsetWidth,
        height = node.offsetHeight;
      const x = Math.max(
        width / 2 + 12,
        Math.min(w - width / 2 - 12, ((this.point.x + 1) * w) / 2),
      );
      let y = Math.max(
        height + 90,
        Math.min(h - 155, ((1 - this.point.y) * h) / 2),
      );
      for (
        let i = 0;
        i < 5 &&
        occupied.some(
          (b) =>
            Math.abs(b.x - x) < (b.width + width) / 2 + 8 &&
            Math.abs(b.y - y) < (b.height + height) / 2 + 10,
        );
        i++
      )
        y -= height + 12;
      if (y < height + 75) {
        node.hidden = true;
        continue;
      }
      node.hidden = false;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      occupied.push({ x, y, width, height });
      shown.add(speech.id);
    }
    for (const [id, node] of this.nodes)
      if (!shown.has(id)) {
        node.remove();
        this.nodes.delete(id);
      }
  }
}
