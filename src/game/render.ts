import {
  CELL_H,
  CELL_W,
  COLS,
  HOUSE_W,
  LAWN_X,
  LAWN_Y,
  LAWN_W,
  ROWS,
  SEED_H,
  SIDE_W,
  VH,
  VW,
} from "./constants";
import { PLANTS, ZOMBIES } from "./catalog";
import type { PlantId } from "./types";
import type { Sim } from "./sim";
import { colAt, rowAt } from "./sim";
import type { Sprites } from "./sprites";

function img(sprites: Sprites, name: string) {
  return sprites[name];
}

function drawSpr(
  ctx: CanvasRenderingContext2D,
  spr: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { flash?: boolean; alpha?: number; scaleX?: number },
) {
  ctx.save();
  ctx.globalAlpha = opts?.alpha ?? 1;
  if (opts?.flash) ctx.filter = "brightness(2.2) saturate(0.4)";
  const sx = opts?.scaleX ?? 1;
  if (sx < 0) {
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), 0);
  }
  if (spr && spr.complete && spr.naturalWidth > 0) {
    ctx.drawImage(spr, x, y, w, h);
  } else {
    ctx.fillStyle = "#5d8a32";
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function render(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  sprites: Sprites,
  hover: { x: number; y: number } | null,
  time: number,
  speed: number,
) {
  ctx.imageSmoothingEnabled = false;
  const night = sim.level.theme === "night";
  const sh = sim.shake > 0 ? (Math.random() - 0.5) * sim.shake * sim.shake * 14 : 0;
  const sv = sim.shake > 0 ? (Math.random() - 0.5) * sim.shake * sim.shake * 10 : 0;
  ctx.save();
  ctx.translate(sh, sv);

  drawBackdrop(ctx, sprites, night);
  drawHouse(ctx, night);
  drawLawn(ctx, night, hover, sim);
  drawGraves(ctx, sim, sprites);
  drawMowers(ctx, sim, sprites);
  drawPlants(ctx, sim, sprites, time);
  if (hover) drawGhost(ctx, sim, sprites, hover);
  drawZombies(ctx, sim, sprites, time);
  drawProjectiles(ctx, sim, sprites);
  drawBoom(ctx, sim, sprites);
  drawParticles(ctx, sim);
  drawSuns(ctx, sim, sprites, time);
  drawFloats(ctx, sim);
  ctx.restore();

  drawHud(ctx, sim, sprites, hover, speed);
  drawBanners(ctx, sim, time);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, sprites: Sprites, night: boolean) {
  const bg = img(sprites, night ? "lawnNight" : "lawnDay");
  if (bg && bg.complete) {
    ctx.drawImage(bg, 0, 0, VW, VH);
    ctx.fillStyle = night ? "rgba(8,12,22,0.55)" : "rgba(12,28,10,0.35)";
    ctx.fillRect(0, 0, VW, VH);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, night ? "#14182e" : "#7ec8f0");
    g.addColorStop(1, night ? "#0c1210" : "#9ad0f5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, night: boolean) {
  ctx.fillStyle = night ? "#3d3420" : "#e0c15a";
  ctx.fillRect(0, LAWN_Y, HOUSE_W, CELL_H * ROWS);
  ctx.fillStyle = night ? "#2a2416" : "#c9a43e";
  for (let r = 0; r < ROWS; r++) {
    ctx.fillRect(6, LAWN_Y + r * CELL_H + 8, HOUSE_W - 16, CELL_H - 16);
  }
  ctx.fillStyle = night ? "#5a3a18" : "#8a4a22";
  ctx.fillRect(22, LAWN_Y + CELL_H * 2 + 18, 28, CELL_H - 28);
  ctx.fillStyle = night ? "#d4a84a" : "#f2e08a";
  if (night) {
    ctx.globalAlpha = 0.7;
    ctx.fillRect(26, LAWN_Y + CELL_H * 2 + 24, 20, 16);
    ctx.globalAlpha = 1;
  }
}

function drawLawn(ctx: CanvasRenderingContext2D, night: boolean, hover: { x: number; y: number } | null, sim: Sim) {
  const a = night ? "#355f32" : "#5fb12c";
  const b = night ? "#2b5229" : "#4e9c24";
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r % 2 === 0 ? a : b;
    ctx.fillRect(LAWN_X, LAWN_Y + r * CELL_H, LAWN_W, CELL_H);
    for (let col = 0; col < COLS; col++) {
      ctx.strokeStyle = night ? "rgba(0,0,0,0.18)" : "rgba(20,40,10,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(LAWN_X + col * CELL_W + 0.5, LAWN_Y + r * CELL_H + 0.5, CELL_W - 1, CELL_H - 1);
    }
  }
  ctx.fillStyle = night ? "#4a4030" : "#cbb58a";
  ctx.fillRect(LAWN_X + LAWN_W, LAWN_Y, SIDE_W, CELL_H * ROWS);
  ctx.fillStyle = night ? "#3a3226" : "#b39f72";
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(LAWN_X + LAWN_W + 8 + i * 22, LAWN_Y, 3, CELL_H * ROWS);
  }

  if (hover && sim.selected) {
    const col = colAt(hover.x);
    const row = rowAt(hover.y);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      ctx.fillStyle = sim.selected === "shovel" ? "rgba(196,92,62,0.32)" : "rgba(232,237,216,0.28)";
      ctx.fillRect(LAWN_X + col * CELL_W, LAWN_Y + row * CELL_H, CELL_W, CELL_H);
      ctx.strokeStyle = "rgba(232,237,216,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(LAWN_X + col * CELL_W + 2, LAWN_Y + row * CELL_H + 2, CELL_W - 4, CELL_H - 4);
    }
  }
}

function drawGraves(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites) {
  for (const g of sim.graves) {
    const x = LAWN_X + g.col * CELL_W + 8;
    const y = LAWN_Y + g.row * CELL_H + 10;
    drawSpr(ctx, img(sprites, "grave"), x, y, CELL_W - 16, CELL_H - 18);
  }
}

function drawMowers(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites) {
  for (const m of sim.mowers) {
    if (m.used && !m.active) continue;
    const y = LAWN_Y + m.row * CELL_H + CELL_H - 58;
    drawSpr(ctx, img(sprites, "mower"), m.x - 6, y, 62, 52);
  }
}

function drawPlants(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites, time: number) {
  for (const p of sim.plants) {
    const def = PLANTS[p.type];
    const bob = Math.sin(time * 3 + p.col + p.row) * (p.hiding ? 0 : 2.2);
    const squash = p.shake > 0 ? 1 + Math.sin(time * 40) * 0.04 : 1;
    let w = 70 * squash;
    let h = 78 / squash;
    if (p.type === "sunshroom" && !p.grown) {
      w *= 0.72;
      h *= 0.72;
    }
    if (p.type === "puffshroom") {
      w *= 0.78;
      h *= 0.78;
    }
    if (p.hiding) {
      h *= 0.55;
      w *= 1.08;
    }
    const x = LAWN_X + p.col * CELL_W + (CELL_W - w) / 2;
    const y = LAWN_Y + p.row * CELL_H + CELL_H - h - 4 + bob;
    const asleep = def.night && sim.level.theme === "day";
    ctx.globalAlpha = asleep ? 0.55 : 1;
    if (def.role === "mine" && !p.armed) {
      ctx.globalAlpha = 0.55;
      h *= 0.55;
    }
    const crack = p.type === "wallnut" && p.hp < p.maxHp * 0.4;
    drawSpr(ctx, img(sprites, def.sprite), x, y, w, h, { flash: crack });
    ctx.globalAlpha = 1;
    if (p.hp < p.maxHp && p.maxHp > 400) {
      const ratio = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(x + 10, y - 6, w - 20, 4);
      ctx.fillStyle = ratio > 0.4 ? "#8fbc4a" : "#c45c3e";
      ctx.fillRect(x + 10, y - 6, (w - 20) * ratio, 4);
    }
    if (def.role === "bomb" && p.fuse > 0) {
      ctx.fillStyle = "#ffe08a";
      ctx.globalAlpha = 0.4 + Math.sin(time * 20) * 0.3;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  if (sim.selected && sim.selected !== "shovel" && sim.phase !== "lost") {
    /* ghost drawn via hover in lawn */
  }
}

function drawZombies(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites, time: number) {
  const zs = [...sim.zombies].sort((a, b) => a.row - b.row || a.x - b.x);
  for (const z of zs) {
    const def = ZOMBIES[z.type];
    const scale = z.type === "football" ? 1.12 : 1;
    const w = 78 * scale;
    const h = 90 * scale;
    const bob = z.eating ? Math.sin(time * 18) * 2 : Math.sin(z.frame + time) * 1;
    const vault = z.vaultT > 0 ? Math.sin((z.vaultT / 0.55) * Math.PI) * 36 : 0;
    const y = LAWN_Y + z.row * CELL_H + CELL_H - h - 2 - vault + bob;
    const x = z.x;
    const alpha = z.deadT > 0 ? Math.max(0, 1 - z.deadT / 0.55) : 1;
    const frame = img(sprites, `zombie${z.frame % 4}`);
    const slow = z.slow > 0;
    ctx.save();
    if (slow) ctx.filter = "hue-rotate(160deg) saturate(0.8)";
    if (z.angry) ctx.filter = "hue-rotate(-20deg) saturate(1.4) brightness(1.1)";
    drawSpr(ctx, frame, x, y, w, h, { flash: z.hit > 0, alpha });
    ctx.restore();
    if (def.spriteAcc && (z.armor > 0 || def.armorKind === "helmet" || def.armorKind === "none")) {
      if (z.armor > 0 || z.type === "flag" || z.type === "football" || z.type === "pole") {
        const acc = img(sprites, def.spriteAcc);
        if (z.type === "cone" || z.type === "bucket" || z.type === "football") {
          drawSpr(ctx, acc, x + 18, y - 4, 42, 40, { alpha });
        } else if (z.type === "flag") {
          drawSpr(ctx, acc, x + 44, y + 8, 36, 48, { alpha });
        } else if (z.type === "newspaper") {
          drawSpr(ctx, acc, x + 6, y + 28, 40, 36, { alpha });
        } else if (z.type === "door") {
          drawSpr(ctx, acc, x - 4, y + 16, 44, 58, { alpha });
        } else if (z.type === "pole") {
          drawSpr(ctx, acc, x + 40, y + 4, 22, 70, { alpha });
        }
      }
    }
    const total = def.hp + def.armor;
    const cur = z.hp + z.armor;
    if (cur < total && z.deadT <= 0) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x + 14, y - 8, w - 28, 4);
      ctx.fillStyle = "#c45c3e";
      ctx.fillRect(x + 14, y - 8, (w - 28) * (cur / total), 4);
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites) {
  for (const p of sim.projectiles) {
    const name = p.kind === "ice" ? "icepea" : p.kind === "spore" ? "spore" : "pea";
    const s = p.kind === "spore" ? 22 : 20;
    drawSpr(ctx, img(sprites, name), p.x - s / 2, p.y - s / 2, s, s);
  }
}

function drawBoom(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites) {
  for (const b of sim.boomFx) {
    const k = Math.max(0, b.life);
    const scale = b.kind === "flame" ? 1.6 : 1.1;
    const w = (80 + (0.55 - k) * 90) * scale;
    const h = b.kind === "flame" ? 56 : w;
    ctx.globalAlpha = Math.min(1, k * 2);
    drawSpr(ctx, img(sprites, b.kind === "flame" ? "flame" : "boom"), b.x - w / 2, b.y - h / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: Sim) {
  for (const p of sim.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawSuns(ctx: CanvasRenderingContext2D, sim: Sim, sprites: Sprites, time: number) {
  for (const s of sim.suns) {
    const bob = Math.sin(time * 4 + s.id) * 3;
    const sc = s.value < 25 ? 0.78 : 1;
    drawSpr(ctx, img(sprites, "sun"), s.x - 22 * sc, s.y - 22 * sc + bob, 44 * sc, 44 * sc);
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.font = "700 16px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  for (const f of sim.floats) {
    ctx.globalAlpha = Math.max(0, f.life / 0.8);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function packetRect(i: number) {
  return { x: 108 + i * 72, y: 8, w: 66, h: 62 };
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  sprites: Sprites,
  hover: { x: number; y: number } | null,
  speed: number,
) {
  ctx.fillStyle = "#1c2614";
  ctx.fillRect(0, 0, VW, SEED_H);
  ctx.fillStyle = "#2a3820";
  ctx.fillRect(0, SEED_H - 3, VW, 3);

  // sun bank
  roundRect(ctx, 10, 8, 88, 62, 10);
  ctx.fillStyle = "#26331c";
  ctx.fill();
  drawSpr(ctx, img(sprites, "sun"), 28, 10, 48, 36);
  ctx.fillStyle = "#e8edd8";
  ctx.font = "700 20px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(sim.sun), 54, 62);

  sim.seeds.forEach((id, i) => {
    const def = PLANTS[id];
    const r = packetRect(i);
    const sel = sim.selected === id;
    const cd = sim.cd[id] ?? 0;
    const afford = sim.sun >= def.cost;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = sel ? "#d7c59a" : "#c4b182";
    ctx.fill();
    ctx.strokeStyle = sel ? "#8fbc4a" : "#6a5a38";
    ctx.lineWidth = sel ? 3 : 1;
    ctx.stroke();
    drawSpr(ctx, img(sprites, def.sprite), r.x + 8, r.y + 2, 50, 42, { alpha: afford ? 1 : 0.45 });
    ctx.fillStyle = afford ? "#2a2418" : "#7a4030";
    ctx.font = "700 12px 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(def.cost), r.x + r.w / 2, r.y + r.h - 6);
    if (cd > 0) {
      const ratio = cd / def.recharge;
      ctx.fillStyle = "rgba(18,24,14,0.62)";
      ctx.fillRect(r.x, r.y, r.w, r.h * ratio);
    }
    if (hover && hover.x >= r.x && hover.x <= r.x + r.w && hover.y >= r.y && hover.y <= r.y + r.h) {
      ctx.fillStyle = "rgba(232,237,216,0.12)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  });

  drawBtn(ctx, VW - 250, 10, 68, 56, speed > 1 ? "×2" : "×1");
  drawBtn(ctx, VW - 170, 10, 68, 56, "暂停");
  roundRect(ctx, VW - 86, 8, 66, 62, 8);
  ctx.fillStyle = sim.selected === "shovel" ? "#d7c59a" : "#c4b182";
  ctx.fill();
  drawSpr(ctx, img(sprites, "shovel"), VW - 78, 12, 50, 50);

  if (sim.selected && sim.selected !== "shovel") {
    const def = PLANTS[sim.selected];
    ctx.font = "500 12px 'Noto Sans SC', sans-serif";
    ctx.fillStyle = "#8a9378";
    ctx.textAlign = "left";
    ctx.fillText(def.name + "  ·  " + def.desc, 110, SEED_H - 8);
  }
}

function drawBtn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = "#26331c";
  ctx.fill();
  ctx.strokeStyle = "#3a4a2a";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#e8edd8";
  ctx.font = "600 14px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

function drawBanners(ctx: CanvasRenderingContext2D, sim: Sim, time: number) {
  if (!sim.banner) return;
  const a = Math.min(1, sim.banner.life * 2, sim.banner.life > 0.3 ? 1 : sim.banner.life / 0.3);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(18,24,14,0.78)";
  ctx.fillRect(0, VH / 2 - 36, VW, 72);
  ctx.fillStyle = "#e8edd8";
  ctx.font = "700 32px 'ZCOOL KuaiLe','Noto Sans SC',sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(sim.banner.text, VW / 2, VH / 2 + 12);
  ctx.restore();
  void time;
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  sprites: Sprites,
  hover: { x: number; y: number },
) {
  if (!sim.selected || sim.selected === "shovel") return;
  const col = colAt(hover.x);
  const row = rowAt(hover.y);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const def = PLANTS[sim.selected];
  ctx.globalAlpha = 0.45;
  drawSpr(
    ctx,
    img(sprites, def.sprite),
    LAWN_X + col * CELL_W + 6,
    LAWN_Y + row * CELL_H + 8,
    CELL_W - 12,
    CELL_H - 12,
  );
  ctx.globalAlpha = 1;
}

export type { PlantId };
