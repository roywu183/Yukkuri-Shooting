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
  private touch?: { id: number; x: number; y: number };
  constructor(
    private canvas: HTMLCanvasElement,
    private actions: InputActions,
    readonly mobile = false,
  ) {
    const options = { signal: this.abort.signal };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!mobile || !this.active || e.pointerType === "mouse" || this.touch)
          return;
        e.preventDefault();
        this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!this.active || this.touch?.id !== e.pointerId) return;
        e.preventDefault();
        actions.aim(e.clientX - this.touch.x, e.clientY - this.touch.y);
        this.touch.x = e.clientX;
        this.touch.y = e.clientY;
      },
      options,
    );
    const release = (e: PointerEvent) => {
      if (this.touch?.id === e.pointerId) this.touch = undefined;
    };
    canvas.addEventListener("pointerup", release, options);
    canvas.addEventListener("pointercancel", release, options);
    canvas.addEventListener("lostpointercapture", release, options);
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
        if (!mobile && this.active && document.pointerLockElement !== canvas)
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
    if (this.mobile) return true;
    try {
      await this.canvas.requestPointerLock();
      return document.pointerLockElement === this.canvas;
    } catch {
      return false;
    }
  }
  unlock() {
    this.active = false;
    if (this.touch && this.canvas.hasPointerCapture(this.touch.id))
      this.canvas.releasePointerCapture(this.touch.id);
    this.touch = undefined;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  bindTouchControls(root: HTMLElement) {
    root.addEventListener(
      "pointerdown",
      (e) => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
          "[data-touch]",
        );
        if (!this.mobile || !this.active || !button || button.disabled) return;
        e.preventDefault();
        const action = button.dataset.touch;
        if (action === "zoom-in") this.actions.zoom(1);
        else if (action === "zoom-out") this.actions.zoom(-1);
        else if (action === "ammo")
          this.actions.ammo(Number(button.dataset.index));
        else if (
          action === "fire" ||
          action === "scope" ||
          action === "reload" ||
          action === "collect" ||
          action === "pause"
        )
          this.actions[action]();
      },
      { signal: this.abort.signal },
    );
  }
  dispose() {
    this.unlock();
    this.abort.abort();
  }
}
