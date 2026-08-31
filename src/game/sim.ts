import { CELL_H, CELL_W, COLS, HOUSE_W, LAWN_X, LAWN_Y, LAWN_W, MAX_PARTICLES, PEA_DMG, ROWS, SIDE_W, VW } from "./constants";
import { PLANTS, ZOMBIES, survivalWave } from "./catalog";
import type {
  FloatText,
  Grave,
  LevelDef,
  Mower,
  Particle,
  Plant,
  PlantId,
  Projectile,
  SpawnEvent,
  SunDrop,
  Zombie,
} from "./types";

export type Phase = "ready" | "play" | "won" | "lost";

export interface Sim {
  t: number;
  sun: number;
  plants: Plant[];
  zombies: Zombie[];
  projectiles: Projectile[];
  suns: SunDrop[];
  mowers: Mower[];
  graves: Grave[];
  particles: Particle[];
  floats: FloatText[];
  grid: (Plant | null)[][];
  level: LevelDef;
  spawns: SpawnEvent[];
  spawnI: number;
  phase: Phase;
  readyT: number;
  shake: number;
  hitstop: number;
  banner: { text: string; life: number } | null;
  selected: PlantId | "shovel" | null;
  cd: Record<string, number>;
  seeds: PlantId[];
  kills: number;
  nextId: number;
  sunTimer: number;
  wave: number;
  survival: boolean;
  lastFlag: number;
  boomFx: { x: number; y: number; life: number; kind: "boom" | "flame" }[];
}

function cellX(col: number) {
  return LAWN_X + col * CELL_W + CELL_W / 2;
}
function cellY(row: number) {
  return LAWN_Y + row * CELL_H + CELL_H / 2;
}
export function colAt(x: number) {
  return Math.floor((x - LAWN_X) / CELL_W);
}
export function rowAt(y: number) {
  return Math.floor((y - LAWN_Y) / CELL_H);
}

export function createSim(level: LevelDef, seeds: PlantId[], survival = false): Sim {
  const grid: (Plant | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const graves: Grave[] = [];
  const used = new Set<string>();
  for (let i = 0; i < level.graves; i++) {
    let r = 0;
    let c = 0;
    let n = 0;
    do {
      r = (Math.random() * ROWS) | 0;
      c = 5 + ((Math.random() * 4) | 0);
      n++;
    } while (used.has(`${r},${c}`) && n < 20);
    used.add(`${r},${c}`);
    graves.push({ row: r, col: Math.min(COLS - 1, c) });
  }
  const cd: Record<string, number> = {};
  for (const id of seeds) cd[id] = 0;
  return {
    t: 0,
    sun: level.startSun,
    plants: [],
    zombies: [],
    projectiles: [],
    suns: [],
    mowers: Array.from({ length: ROWS }, (_, row) => ({ row, x: 18, active: false, used: false })),
    graves,
    particles: [],
    floats: [],
    grid,
    level,
    spawns: level.spawns.slice(),
    spawnI: 0,
    phase: "ready",
    readyT: 3.1,
    shake: 0,
    hitstop: 0,
    banner: { text: "准备就绪", life: 1.1 },
    selected: null,
    cd,
    seeds,
    kills: 0,
    nextId: 1,
    sunTimer: 6,
    wave: 0,
    survival,
    lastFlag: -1,
    boomFx: [],
  };
}

function nid(sim: Sim) {
  return sim.nextId++;
}

export function spawnParticle(sim: Sim, p: Particle) {
  if (sim.particles.length >= MAX_PARTICLES) sim.particles.shift();
  sim.particles.push(p);
}

function burst(sim: Sim, x: number, y: number, n: number, color: string, speed = 80) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random());
    spawnParticle(sim, {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4,
      max: 0.7,
      size: 2 + Math.random() * 3,
      color,
      g: 40,
    });
  }
}

function float(sim: Sim, x: number, y: number, text: string, color: string) {
  sim.floats.push({ x, y, vy: -28, text, life: 0.8, color });
}

function spawnSun(sim: Sim, x: number, y: number, value: number, fromPlant: boolean) {
  sim.suns.push({
    id: nid(sim),
    x,
    y: fromPlant ? y - 10 : LAWN_Y - 20,
    ty: fromPlant ? y - 18 : y,
    vy: fromPlant ? -40 : 40,
    value,
    life: 12,
    fromPlant,
    collect: 0,
  });
}

function pickRow(sim: Sim) {
  const counts = [0, 0, 0, 0, 0];
  for (const z of sim.zombies) {
    if (z.hp > 0) counts[z.row]!++;
  }
  let min = Infinity;
  for (const c of counts) min = Math.min(min, c);
  const cands: number[] = [];
  for (let i = 0; i < ROWS; i++) if (counts[i] === min) cands.push(i);
  return cands[(Math.random() * cands.length) | 0] ?? 0;
}

function spawnZombie(sim: Sim, type: SpawnEvent["type"], row: number) {
  const def = ZOMBIES[type];
  const r = row < 0 ? pickRow(sim) : row;
  sim.zombies.push({
    id: nid(sim),
    type,
    row: r,
    x: VW - 28,
    hp: def.hp,
    armor: def.armor,
    eating: null,
    slow: 0,
    hit: 0,
    frame: 0,
    frameT: 0,
    vaulted: false,
    vaultT: 0,
    angry: false,
    deadT: 0,
    groanT: 4 + Math.random() * 8,
  });
}

function plantAt(sim: Sim, row: number, col: number) {
  return sim.grid[row]?.[col] ?? null;
}

function firstZombie(sim: Sim, row: number, x: number, range: number): Zombie | null {
  let best: Zombie | null = null;
  for (const z of sim.zombies) {
    if (z.row !== row || z.hp <= 0 || z.deadT > 0) continue;
    if (z.x + 20 < x) continue;
    if (z.x - x > range) continue;
    if (!best || z.x < best.x) best = z;
  }
  return best;
}

function shoot(sim: Sim, p: Plant, kind: Projectile["kind"]) {
  const def = PLANTS[p.type];
  sim.projectiles.push({
    id: nid(sim),
    kind,
    row: p.row,
    x: cellX(p.col) + 18,
    y: cellY(p.row) - 10,
    vx: kind === "spore" ? 220 : 280,
    dmg: def.dmg,
    slow: def.slow ?? 0,
    pierce: !!def.pierce,
    hit: new Set(),
    life: 3,
  });
}

function harmZombie(sim: Sim, z: Zombie, dmg: number, slow: number, ignoreDoor: boolean) {
  if (z.hp <= 0) return;
  let rest = dmg;
  const skipArmor = ignoreDoor && ZOMBIES[z.type].armorKind === "door";
  if (z.armor > 0 && !skipArmor) {
    const a = Math.min(z.armor, rest);
    z.armor -= a;
    rest -= a;
    if (z.armor <= 0 && z.type === "newspaper" && !z.angry) {
      z.angry = true;
      z.slow = 0;
      float(sim, z.x, cellY(z.row) - 30, "!!", "#c45c3e");
    }
  }
  if (rest > 0) z.hp -= rest;
  z.hit = 0.12;
  if (slow > 0 && !z.angry) z.slow = Math.max(z.slow, slow);
  if (z.hp <= 0) {
    z.hp = 0;
    z.deadT = 0.001;
    sim.kills++;
    burst(sim, z.x + 20, cellY(z.row), 10, "#6a8a4a", 70);
  }
}

function explodeAt(sim: Sim, row: number, col: number, radiusCells: number, dmg: number, kind: "boom" | "flame") {
  const x = cellX(col);
  const y = cellY(row);
  sim.boomFx.push({ x, y, life: 0.55, kind });
  sim.shake = Math.max(sim.shake, kind === "flame" ? 0.7 : 0.9);
  sim.hitstop = Math.max(sim.hitstop, 0.07);
  burst(sim, x, y, 28, "#ff8a3a", 140);
  burst(sim, x, y, 12, "#ffe08a", 90);
  for (const z of sim.zombies) {
    if (z.hp <= 0) continue;
    if (kind === "flame") {
      if (z.row === row) harmZombie(sim, z, dmg, 0, true);
    } else {
      const dc = Math.abs(colAt(z.x + 16) - col);
      const dr = Math.abs(z.row - row);
      if (dc <= radiusCells && dr <= radiusCells) harmZombie(sim, z, dmg, 0, true);
    }
  }
}

export function canPlant(sim: Sim, row: number, col: number, type: PlantId | "shovel"): string | null {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return "界外";
  if (type === "shovel") return plantAt(sim, row, col) ? null : "空地";
  if (sim.graves.some((g) => g.row === row && g.col === col)) return "墓碑";
  if (plantAt(sim, row, col)) return "占用";
  const def = PLANTS[type];
  if (sim.sun < def.cost) return "阳光不足";
  if ((sim.cd[type] ?? 0) > 0) return "冷却";
  if (def.night && sim.level.theme === "day") {
    /* mushrooms sleep in day — still plantable but they nap; allow planting */
  }
  return null;
}

export function tryPlant(sim: Sim, row: number, col: number, type: PlantId | "shovel"): boolean {
  const err = canPlant(sim, row, col, type);
  if (err) return false;
  if (type === "shovel") {
    const p = plantAt(sim, row, col);
    if (!p) return false;
    removePlant(sim, p);
    burst(sim, cellX(col), cellY(row), 8, "#c4a574", 50);
    return true;
  }
  const def = PLANTS[type];
  const p: Plant = {
    id: nid(sim),
    type,
    row,
    col,
    hp: def.hp,
    maxHp: def.hp,
    cd: 0.3,
    prodT: def.sunEvery ? def.sunEvery * 0.55 : 0,
    age: 0,
    fuse: def.role === "bomb" ? 0.85 : 0,
    armed: def.role !== "mine",
    bursting: 0,
    grown: type !== "sunshroom",
    hiding: false,
    shake: 0.2,
  };
  sim.plants.push(p);
  sim.grid[row]![col] = p;
  sim.sun -= def.cost;
  sim.cd[type] = def.recharge;
  burst(sim, cellX(col), cellY(row) + 16, 6, "#8fbc4a", 40);
  return true;
}

function removePlant(sim: Sim, p: Plant) {
  sim.plants = sim.plants.filter((x) => x.id !== p.id);
  if (sim.grid[p.row]?.[p.col]?.id === p.id) sim.grid[p.row]![p.col] = null;
}

function graveSpawn(sim: Sim) {
  for (const g of sim.graves) {
    if (Math.random() < 0.65) spawnZombie(sim, Math.random() < 0.4 ? "cone" : "basic", g.row);
  }
}

function nextSurvivalWave(sim: Sim) {
  sim.wave++;
  sim.spawns = survivalWave(sim.wave).map((s) => ({ ...s, t: s.t + sim.t }));
  sim.spawnI = 0;
  sim.banner = { text: `第 ${sim.wave + 1} 波`, life: 1.6 };
}

export function collectSun(sim: Sim, id: number): boolean {
  const s = sim.suns.find((x) => x.id === id);
  if (!s || s.collect > 0) return false;
  s.collect = 0.001;
  s.ty = 28;
  return true;
}

export function sunAt(sim: Sim, x: number, y: number): SunDrop | null {
  let best: SunDrop | null = null;
  let bestD = 38 * 38;
  for (const s of sim.suns) {
    if (s.collect > 0) continue;
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function stepSim(sim: Sim, dt: number, events: { kind: string }[]) {
  if (sim.phase === "ready") {
    sim.readyT -= dt;
    if (sim.readyT <= 2 && sim.banner?.text === "准备就绪") sim.banner = { text: "种植", life: 1 };
    if (sim.readyT <= 1 && sim.banner?.text === "种植") sim.banner = { text: "开始！", life: 1 };
    if (sim.readyT <= 0) {
      sim.phase = "play";
      sim.banner = null;
    }
    tickFx(sim, dt);
    for (const id of sim.seeds) sim.cd[id] = Math.max(0, (sim.cd[id] ?? 0) - dt);
    return;
  }
  if (sim.phase === "won" || sim.phase === "lost") {
    tickFx(sim, dt);
    return;
  }
  if (sim.hitstop > 0) {
    sim.hitstop -= dt;
    tickFx(sim, dt);
    return;
  }

  sim.t += dt;
  sim.shake = Math.max(0, sim.shake - dt * 1.8);
  if (sim.banner) {
    sim.banner.life -= dt;
    if (sim.banner.life <= 0) sim.banner = null;
  }
  for (const id of sim.seeds) {
    sim.cd[id] = Math.max(0, (sim.cd[id] ?? 0) - dt);
  }

  // falling sun (day)
  if (sim.phase === "play" && sim.level.theme === "day") {
    sim.sunTimer -= dt;
    if (sim.sunTimer <= 0) {
      sim.sunTimer = 9 + Math.random() * 4;
      spawnSun(sim, LAWN_X + 40 + Math.random() * (LAWN_W - 80), LAWN_Y + 40 + Math.random() * (CELL_H * ROWS - 60), 25, false);
    }
  }

  // spawns
  if (sim.phase === "play") {
    while (sim.spawnI < sim.spawns.length && sim.spawns[sim.spawnI]!.t <= sim.t) {
      const s = sim.spawns[sim.spawnI++]!;
      if (s.flag && s.t !== sim.lastFlag) {
        sim.lastFlag = s.t;
        sim.banner = { text: s.huge ? "一大波行尸正在接近" : "行尸来袭", life: 2.2 };
        events.push({ kind: "wave" });
        if (s.huge) graveSpawn(sim);
      }
      spawnZombie(sim, s.type, s.row);
    }
    if (sim.survival && sim.spawnI >= sim.spawns.length && sim.zombies.every((z) => z.hp <= 0 || z.deadT > 0)) {
      nextSurvivalWave(sim);
    }
  }

  // plants
  for (const p of [...sim.plants]) {
    const def = PLANTS[p.type];
    p.age += dt;
    p.shake = Math.max(0, p.shake - dt);
    const asleep = def.night && sim.level.theme === "day";
    if (def.role === "mine" && !p.armed) {
      if (p.age >= (def.armTime ?? 14)) p.armed = true;
    }
    if (def.role === "bomb" && p.fuse > 0) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        explodeAt(sim, p.row, p.col, 1, def.dmg, def.splash === "row" ? "flame" : "boom");
        events.push({ kind: "explode" });
        removePlant(sim, p);
        continue;
      }
    }
    if (asleep) continue;
    if (def.role === "sun" && def.sunEvery) {
      p.prodT += dt;
      if (p.type === "sunshroom" && !p.grown && p.age > 110) p.grown = true;
      if (p.prodT >= def.sunEvery) {
        p.prodT = 0;
        const val = p.type === "sunshroom" && !p.grown ? 15 : 25;
        spawnSun(sim, cellX(p.col), cellY(p.row) - 20, val, true);
      }
    }
    if (def.role === "shoot") {
      const near = firstZombie(sim, p.row, cellX(p.col) - 10, CELL_W * 1.6);
      p.hiding = p.type === "scaredyshroom" && !!near;
      if (p.hiding) continue;
      p.cd -= dt;
      if (p.bursting > 0) {
        p.bursting -= dt;
        if (p.bursting <= 0) {
          shoot(sim, p, "pea");
          events.push({ kind: "shoot" });
        }
      }
      const tgt = firstZombie(sim, p.row, cellX(p.col) + 8, def.range);
      if (p.cd <= 0 && tgt) {
        p.cd = def.fire;
        if (def.pierce) {
          for (const z of sim.zombies) {
            if (z.row !== p.row || z.hp <= 0) continue;
            if (z.x > cellX(p.col) && z.x - cellX(p.col) < def.range) {
              harmZombie(sim, z, def.dmg, 0, true);
            }
          }
          sim.boomFx.push({ x: cellX(p.col) + CELL_W * 2, y: cellY(p.row), life: 0.18, kind: "flame" });
          events.push({ kind: "shoot" });
        } else {
          const kind: Projectile["kind"] = p.type === "snowpea" ? "ice" : p.type === "puffshroom" || p.type === "scaredyshroom" ? "spore" : "pea";
          shoot(sim, p, kind);
          events.push({ kind: "shoot" });
          if (def.burst && def.burst > 1) p.bursting = 0.22;
        }
      }
    }
  }

  // projectiles
  for (const pr of sim.projectiles) {
    pr.x += pr.vx * dt;
    pr.life -= dt;
    for (const z of sim.zombies) {
      if (z.row !== pr.row || z.hp <= 0 || pr.hit.has(z.id)) continue;
      if (pr.x > z.x + 6 && pr.x < z.x + 52) {
        pr.hit.add(z.id);
        harmZombie(sim, z, pr.dmg, pr.slow, pr.pierce);
        events.push({ kind: "splat" });
        burst(sim, pr.x, pr.y, 4, pr.kind === "ice" ? "#a8e4ff" : "#7dba45", 50);
        if (!pr.pierce) pr.life = 0;
      }
    }
    if (pr.x > VW + 20) pr.life = 0;
  }
  sim.projectiles = sim.projectiles.filter((p) => p.life > 0);

  // zombies
  for (const z of sim.zombies) {
    if (z.deadT > 0) {
      z.deadT += dt;
      continue;
    }
    z.hit = Math.max(0, z.hit - dt);
    z.slow = Math.max(0, z.slow - dt);
    z.groanT -= dt;
    if (z.groanT <= 0) {
      z.groanT = 6 + Math.random() * 10;
      events.push({ kind: "groan" });
    }
    const def = ZOMBIES[z.type];
    let spd = def.speed;
    if (z.type === "newspaper" && z.angry) spd = 62;
    if (z.type === "pole" && !z.vaulted) spd = def.speed;
    if (z.type === "pole" && z.vaulted && z.vaultT <= 0) spd = 24;
    if (z.slow > 0 && !z.angry) spd *= 0.45;
    if (z.vaultT > 0) {
      z.vaultT -= dt;
      z.x -= 170 * dt;
      continue;
    }
    z.frameT += dt * (spd / 22);
    if (z.frameT > 0.18) {
      z.frameT = 0;
      z.frame = (z.frame + 1) % 4;
    }

    const col = Math.max(0, Math.min(COLS - 1, colAt(z.x + 18)));
    const plant = plantAt(sim, z.row, col);
    const inCell = z.x < LAWN_X + (col + 1) * CELL_W - 8 && z.x + 30 > LAWN_X + col * CELL_W;

    if (plant && inCell) {
      const pdef = PLANTS[plant.type];
      if (pdef.role === "mine" && !plant.armed) {
        // walk over unarmed mine
      } else if (pdef.role === "mine" && plant.armed) {
        explodeAt(sim, plant.row, plant.col, 0, pdef.dmg, "boom");
        events.push({ kind: "explode" });
        removePlant(sim, plant);
        continue;
      } else if (z.type === "pole" && !z.vaulted && pdef.role !== "bomb") {
        z.vaulted = true;
        z.vaultT = 0.5;
        z.x -= 12;
        continue;
      } else {
        z.eating = plant.id;
        plant.hp -= def.eat * dt;
        plant.shake = 0.12;
        if (Math.random() < dt * 3) events.push({ kind: "bite" });
        if (plant.hp <= 0) {
          burst(sim, cellX(plant.col), cellY(plant.row), 10, "#6a8a3a", 60);
          removePlant(sim, plant);
          z.eating = null;
        }
        continue;
      }
    }
    z.eating = null;
    z.x -= spd * dt;

    if (z.x < HOUSE_W - 8) {
      const m = sim.mowers[z.row]!;
      if (!m.used && !m.active) {
        m.active = true;
        events.push({ kind: "mower" });
      } else if (m.used && !m.active) {
        sim.phase = "lost";
        events.push({ kind: "lose" });
      }
    }
  }
  sim.zombies = sim.zombies.filter((z) => z.deadT < 0.55);

  // mowers
  for (const m of sim.mowers) {
    if (!m.active) continue;
    m.x += 420 * dt;
    for (const z of sim.zombies) {
      if (z.row === m.row && z.hp > 0 && z.x < m.x + 50 && z.x > m.x - 20) {
        z.hp = 0;
        z.deadT = 0.001;
        sim.kills++;
        burst(sim, z.x, cellY(z.row), 8, "#c45c3e", 80);
      }
    }
    if (m.x > VW + 40) {
      m.active = false;
      m.used = true;
    }
  }

  // suns
  for (const s of sim.suns) {
    if (s.collect > 0) {
      s.collect += dt;
      s.x += (54 - s.x) * (1 - Math.exp(-8 * dt));
      s.y += (36 - s.y) * (1 - Math.exp(-8 * dt));
      if (s.collect > 0.35) {
        sim.sun += s.value;
        events.push({ kind: "sun" });
        s.life = 0;
      }
      continue;
    }
    s.life -= dt;
    if (s.fromPlant) {
      s.vy += 90 * dt;
      s.y += s.vy * dt;
      if (s.y > s.ty && s.vy > 0) {
        s.y = s.ty;
        s.vy *= -0.35;
        if (Math.abs(s.vy) < 12) s.vy = 0;
      }
    } else if (s.y < s.ty) {
      s.y += 55 * dt;
      if (s.y > s.ty) s.y = s.ty;
    }
  }
  sim.suns = sim.suns.filter((s) => s.life > 0);

  tickFx(sim, dt);

  if (sim.phase === "play" && !sim.survival) {
    const left = sim.spawnI < sim.spawns.length || sim.zombies.some((z) => z.hp > 0 || z.deadT > 0);
    const bombs = sim.plants.some((p) => PLANTS[p.type].role === "bomb");
    if (!left && !bombs) {
      sim.phase = "won";
      events.push({ kind: "win" });
    }
  }
}

function tickFx(sim: Sim, dt: number) {
  for (const p of sim.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.g * dt;
  }
  sim.particles = sim.particles.filter((p) => p.life > 0);
  for (const f of sim.floats) {
    f.life -= dt;
    f.y += f.vy * dt;
  }
  sim.floats = sim.floats.filter((f) => f.life > 0);
  for (const b of sim.boomFx) b.life -= dt;
  sim.boomFx = sim.boomFx.filter((b) => b.life > 0);
}

export function seedHit(x: number, y: number, n: number): number {
  if (y > 70 || x < 108) return -1;
  const i = Math.floor((x - 108) / 72);
  if (i >= 0 && i < n) return i;
  return -1;
}

export function shovelHit(x: number, y: number) {
  return x > VW - 86 && x < VW - 18 && y < 70;
}

export function pauseHit(x: number, y: number) {
  return x > VW - 170 && x < VW - 96 && y < 70;
}

export function speedHit(x: number, y: number) {
  return x > VW - 250 && x < VW - 176 && y < 70;
}

export { cellX, cellY, SIDE_W, PEA_DMG };
