export interface InputActions {
  fire: () => void;
  scope: () => void;
  zoom: (delta: number) => void;
  reload: () => void;
  ammo: (index: number) => void;
  collect: () => void;
  pause: () => void;
  aim: (x: number, y: number) => void;
}
export class Input {
  active = false;
  private abort = new AbortController();
  constructor(
    private canvas: HTMLCanvasElement,
    private actions: InputActions,
  ) {
    const options = { signal: this.abort.signal };
    document.addEventListener(
      "mousemove",
      (e) => {
        if (this.active && document.pointerLockElement === canvas)
          actions.aim(e.movementX, e.movementY);
      },
      options,
    );
    canvas.addEventListener(
      "mousedown",
      (e) => {
        if (!this.active || document.pointerLockElement !== canvas) return;
        if (e.button === 0) actions.fire();
        if (e.button === 2) actions.scope();
      },
      options,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), options);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.active) actions.zoom(-Math.sign(e.deltaY));
      },
      { ...options, passive: false },
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (!this.active || e.repeat || document.pointerLockElement !== canvas)
          return;
        if (e.code === "KeyR") actions.reload();
        if (e.code === "KeyE") actions.collect();
        if (e.code.startsWith("Digit"))
          actions.ammo(Number(e.code.slice(5)) - 1);
        if (e.code === "Escape") actions.pause();
      },
      options,
    );
    document.addEventListener(
      "pointerlockchange",
      () => {
        if (this.active && document.pointerLockElement !== canvas)
          actions.pause();
      },
      options,
    );
    document.addEventListener(
      "pointerlockerror",
      () => {
        if (this.active) actions.pause();
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.active) actions.pause();
      },
      options,
    );
    window.addEventListener(
      "blur",
      () => {
        if (this.active) actions.pause();
      },
      options,
    );
  }
  async lock() {
    try {
      await this.canvas.requestPointerLock();
      return document.pointerLockElement === this.canvas;
    } catch {
      return false;
    }
  }
  unlock() {
    this.active = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  dispose() {
    this.unlock();
    this.abort.abort();
  }
}
