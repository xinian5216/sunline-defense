import { STEP, VH, VW } from "./constants";
import { PLANTS } from "./catalog";
import { render } from "./render";
import {
  collectSun,
  colAt,
  createSim,
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

  private world(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VW,
      y: ((e.clientY - r.top) / r.height) * VH,
    };
  }

  handlePointer(p: { x: number; y: number }) {
    this.hover = p;
    if (this.paused || this.sim.phase === "won" || this.sim.phase === "lost") return;
    const sun = sunAt(this.sim, p.x, p.y);
    if (sun) {
      collectSun(this.sim, sun.id);
      return;
    }
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
    if (this.sim.selected && row >= 0 && col >= 0) {
      const ok = tryPlant(this.sim, row, col, this.sim.selected);
      if (ok) {
        if (this.sim.selected === "shovel") this.audio.shovel();
        else this.audio.plant();
        if (this.sim.selected !== "shovel") this.sim.selected = null;
      }
    }
  }

  private bind() {
    const onMove = (e: PointerEvent) => {
      this.hover = this.world(e);
    };
    const onDown = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      this.audio.unlock();
      this.handlePointer(this.world(e));
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
    const onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    const onResize = () => this.fit();
    const onVis = () => {
      if (document.visibilityState === "visible") this.audio.unlock();
    };
    this.canvas.addEventListener("pointermove", onMove);
    this.canvas.addEventListener("pointerdown", onDown);
    this.canvas.addEventListener("pointercancel", onMove);
    this.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.visualViewport?.addEventListener("resize", onResize);
    this.unsubs.push(() => {
      this.canvas.removeEventListener("pointermove", onMove);
      this.canvas.removeEventListener("pointerdown", onDown);
      this.canvas.removeEventListener("pointercancel", onMove);
      this.canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
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
    const scale = Math.min(r.width / VW, r.height / VH);
    const w = Math.max(1, Math.floor(VW * scale));
    const h = Math.max(1, Math.floor(VH * scale));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }
}
