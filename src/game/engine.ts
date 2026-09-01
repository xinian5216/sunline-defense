import { COLS, ROWS, STEP, VH, VW } from "./constants";
import { render } from "./render";
import {
  canPlant,
  collectSun,
  colAt,
  createSim,
  float,
  pauseHit,
  rowAt,
  seedHit,
  shovelHit,
  speedHit,
  stepSim,
  sunAt,
  tryPlant,
  type Sim,
} from "./sim";
import type { LevelDef, PlantId } from "./types";
import type { Sprites } from "./sprites";
import type { GameAudio } from "./audio";

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sim: Sim;
  sprites: Sprites;
  audio: GameAudio;
  running = false;
  paused = false;
  speed = 1;
  acc = 0;
  last = 0;
  hover: { x: number; y: number } | null = null;
  raf = 0;
  onWin: () => void = () => {};
  onLose: () => void = () => {};
  onPause: () => void = () => {};
  time = 0;
  reduced = false;
  shakeEnabled = true;
  private ended = false;
  private keys = new Set<string>();
  private unsubs: Array<() => void> = [];
  private press: { id: number; cx: number; cy: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    level: LevelDef,
    seeds: PlantId[],
    sprites: Sprites,
    audio: GameAudio,
    survival: boolean,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.sim = createSim(level, seeds, survival);
    this.sprites = sprites;
    this.audio = audio;
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.bind();
    this.fit();
    (window as unknown as { __sunline?: Engine }).__sunline = this;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    this.audio.startMusic(this.sim.level.theme === "night");
    void this.lockLandscape();
    const loop = (now: number) => {
      if (!this.running) return;
      const raw = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) {
        this.acc += raw * this.speed;
        while (this.acc >= STEP) {
          const ev: { kind: string }[] = [];
          stepSim(this.sim, STEP, ev);
          this.handleEvents(ev);
          this.acc -= STEP;
        }
        this.time += raw;
        this.audio.update(raw);
      }
      this.paint();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.audio.stopMusic();
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  resume() {
    this.paused = false;
    this.last = performance.now();
  }

  private handleEvents(ev: { kind: string }[]) {
    for (const e of ev) {
      if (e.kind === "shoot") this.audio.shoot();
      else if (e.kind === "splat") this.audio.splat();
      else if (e.kind === "explode") this.audio.explode();
      else if (e.kind === "mower") this.audio.mower();
      else if (e.kind === "sun") this.audio.sun();
      else if (e.kind === "wave") this.audio.wave();
      else if (e.kind === "groan") this.audio.groan();
      else if (e.kind === "bite") this.audio.bite();
      else if (e.kind === "win" && !this.ended) {
        this.ended = true;
        this.audio.win();
        this.onWin();
      } else if (e.kind === "lose" && !this.ended) {
        this.ended = true;
        this.audio.lose();
        this.onLose();
      }
    }
  }

  private paint() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.floor(VW * dpr) || this.canvas.height !== Math.floor(VH * dpr)) {
      this.canvas.width = Math.floor(VW * dpr);
      this.canvas.height = Math.floor(VH * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, VW, VH);
    const shakeOn = this.sim.shake > 0 && !this.reduced && this.shakeEnabled;
    const s = shakeOn ? this.sim : { ...this.sim, shake: 0 };
    render(this.ctx, s, this.sprites, this.hover, this.time, this.speed);
  }

  private world(e: { clientX: number; clientY: number; pointerType?: string }) {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const lift = e.pointerType === "touch" ? 12 : 0;
    return {
      x: ((e.clientX - r.left) / w) * VW,
      y: ((e.clientY - lift - r.top) / h) * VH,
    };
  }

  handlePointer(p: { x: number; y: number }) {
    this.hover = p;
    if (this.paused || this.sim.phase === "won" || this.sim.phase === "lost") return;
    const si = seedHit(p.x, p.y, this.sim.seeds.length);
    if (si >= 0) {
      const id = this.sim.seeds[si]!;
      this.sim.selected = this.sim.selected === id ? null : id;
      this.audio.click();
      return;
    }
    if (shovelHit(p.x, p.y)) {
      this.sim.selected = this.sim.selected === "shovel" ? null : "shovel";
      this.audio.click();
      return;
    }
    if (pauseHit(p.x, p.y)) {
      this.paused = true;
      this.onPause();
      return;
    }
    if (speedHit(p.x, p.y)) {
      this.speed = this.speed === 1 ? 2 : 1;
      this.audio.click();
      return;
    }
    const col = colAt(p.x);
    const row = rowAt(p.y);
    if (this.sim.selected && row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      const err = canPlant(this.sim, row, col, this.sim.selected);
      if (err) {
        const msg =
          err === "占用" ? "已有植物" : err === "空地" ? "这里没有植物" : err === "界外" ? "点在草地上" : err;
        float(this.sim, p.x, Math.max(p.y, 100), msg, "#e8b4a4");
        return;
      }
      const ok = tryPlant(this.sim, row, col, this.sim.selected);
      if (ok) {
        if (this.sim.selected === "shovel") this.audio.shovel();
        else this.audio.plant();
        if (this.sim.selected !== "shovel") this.sim.selected = null;
      }
      return;
    }
    const sun = sunAt(this.sim, p.x, p.y);
    if (sun) {
      collectSun(this.sim, sun.id);
    }
  }

  private bind() {
    const onMove = (e: PointerEvent) => {
      this.hover = this.world(e);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      this.audio.unlock();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* older webviews */
      }
      this.press = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!this.press || e.pointerId !== this.press.id) return;
      const start = this.press;
      this.press = null;
      const dist = Math.hypot(e.clientX - start.cx, e.clientY - start.cy);
      if (dist > 26) return;
      this.handlePointer(this.world(e));
    };
    const onCancel = () => {
      this.press = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        this.paused = true;
        this.onPause();
        return;
      }
      if (e.code === "KeyF") {
        this.speed = this.speed === 1 ? 2 : 1;
      }
      if (e.code === "KeyX" || e.code === "KeyS") {
        this.sim.selected = this.sim.selected === "shovel" ? null : "shovel";
      }
      const n = Number(e.code.replace("Digit", "").replace("Numpad", ""));
      if (n >= 1 && n <= this.sim.seeds.length) {
        this.sim.selected = this.sim.seeds[n - 1]!;
      }
      this.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    const onResize = () => this.fit();
    const onVis = () => {
      if (document.visibilityState === "visible") this.audio.unlock();
    };
    this.canvas.addEventListener("pointermove", onMove);
    this.canvas.addEventListener("pointerdown", onDown);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onCancel);
    this.canvas.addEventListener("lostpointercapture", onCancel);
    this.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.visualViewport?.addEventListener("resize", onResize);
    this.unsubs.push(() => {
      this.canvas.removeEventListener("pointermove", onMove);
      this.canvas.removeEventListener("pointerdown", onDown);
      this.canvas.removeEventListener("pointerup", onPointerUp);
      this.canvas.removeEventListener("pointercancel", onCancel);
      this.canvas.removeEventListener("lostpointercapture", onCancel);
      this.canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.visualViewport?.removeEventListener("resize", onResize);
    });
  }

  private async lockLandscape() {
    try {
      const orient = screen.orientation as ScreenOrientation & { lock?: (m: string) => Promise<void> };
      await orient.lock?.("landscape");
    } catch {
      /* browsers only allow this in fullscreen / installed app */
    }
  }

  private fit() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const vv = window.visualViewport;
    const pw = Math.max(1, Math.min(r.width, vv?.width ?? r.width));
    const ph = Math.max(1, Math.min(r.height, vv?.height ?? r.height));
    const scale = Math.min(pw / VW, ph / VH);
    const w = Math.max(1, Math.floor(VW * scale));
    const h = Math.max(1, Math.floor(VH * scale));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }
}
