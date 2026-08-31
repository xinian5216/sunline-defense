export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicGain = 0.45;
  sfxGain = 0.7;
  muted = false;
  private musicOn = false;
  private osc: OscillatorNode | null = null;
  private musicGainNode: GainNode | null = null;
  private step = 0;
  private timer = 0;
  private night = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.apply();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  apply() {
    const t = this.ctx?.currentTime ?? 0;
    const m = this.muted ? 0 : 1;
    this.master?.gain.setTargetAtTime(m, t, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.musicGain * this.musicGain, t, 0.03);
    this.sfxBus?.gain.setTargetAtTime(this.sfxGain * this.sfxGain, t, 0.03);
  }

  setMusic(v: number) {
    this.musicGain = v;
    this.apply();
  }
  setSfx(v: number) {
    this.sfxGain = v;
    this.apply();
  }
  setMuted(v: boolean) {
    this.muted = v;
    this.apply();
  }

  startMusic(night: boolean) {
    this.night = night;
    this.unlock();
    this.musicOn = true;
    this.timer = 0;
    this.step = 0;
  }

  stopMusic() {
    this.musicOn = false;
    this.killTone();
  }

  update(dt: number) {
    if (!this.musicOn || !this.ctx || !this.musicBus) return;
    this.timer += dt;
    const beat = this.night ? 0.42 : 0.34;
    if (this.timer < beat) return;
    this.timer -= beat;
    const day = [196, 220, 262, 294, 330, 294, 262, 220];
    const ngt = [147, 165, 196, 220, 196, 165, 131, 165];
    const seq = this.night ? ngt : day;
    const f = seq[this.step % seq.length]!;
    this.step++;
    this.tone(f, this.night ? 0.28 : 0.22, 0.035, "triangle", this.musicBus, 0.012);
    if (this.step % 4 === 0) this.tone(f / 2, 0.18, 0.04, "sine", this.musicBus, 0.01);
  }

  plant() {
    this.blip(420, 620, 0.09, "square", 0.06);
  }
  shoot() {
    this.blip(520, 280, 0.06, "square", 0.04);
  }
  splat() {
    this.noise(0.07, 0.05, 900);
  }
  sun() {
    this.blip(660, 980, 0.12, "sine", 0.07);
  }
  explode() {
    this.noise(0.28, 0.14, 220);
    this.blip(140, 50, 0.22, "sawtooth", 0.1);
  }
  mower() {
    this.blip(90, 60, 0.4, "sawtooth", 0.08);
    this.noise(0.35, 0.08, 300);
  }
  groan() {
    this.blip(110, 80, 0.22, "sawtooth", 0.05);
  }
  bite() {
    this.blip(180, 90, 0.08, "square", 0.05);
  }
  collect() {
    this.blip(740, 1180, 0.1, "sine", 0.06);
  }
  wave() {
    this.blip(200, 420, 0.25, "triangle", 0.08);
  }
  win() {
    this.blip(392, 523, 0.16, "triangle", 0.08);
    setTimeout(() => this.blip(523, 659, 0.18, "triangle", 0.08), 140);
    setTimeout(() => this.blip(659, 784, 0.28, "triangle", 0.09), 280);
  }
  lose() {
    this.blip(300, 120, 0.5, "sawtooth", 0.09);
  }
  click() {
    this.blip(700, 500, 0.04, "square", 0.035);
  }
  shovel() {
    this.blip(240, 160, 0.08, "square", 0.05);
  }

  private killTone() {
    try {
      this.osc?.stop();
    } catch {
      /* already stopped */
    }
    this.osc = null;
  }

  private tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType,
    bus: GainNode,
    attack = 0.01,
  ) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private blip(a: number, b: number, dur: number, type: OscillatorType, vol: number) {
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(a, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, b), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number) {
    this.unlock();
    if (!this.ctx || !this.sfxBus) return;
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur);
  }
}
