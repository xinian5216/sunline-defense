import { SAVE_KEY, SAVE_VERSION } from "./constants";
import type { PlantId, SaveData } from "./types";

const DEFAULT: SaveData = {
  version: SAVE_VERSION,
  unlocked: 0,
  plants: ["peashooter"],
  survivalBest: 0,
  completed: [],
  settings: { music: 0.45, sfx: 0.7, shake: true },
};

function migrate(raw: SaveData): SaveData {
  const s = { ...DEFAULT, ...raw, settings: { ...DEFAULT.settings, ...raw.settings } };
  s.version = SAVE_VERSION;
  if (!s.plants.includes("peashooter")) s.plants = ["peashooter", ...s.plants];
  return s;
}

export function loadSave(): SaveData {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return { ...DEFAULT, plants: [...DEFAULT.plants], settings: { ...DEFAULT.settings } };
    return migrate(JSON.parse(t) as SaveData);
  } catch {
    return { ...DEFAULT, plants: [...DEFAULT.plants], settings: { ...DEFAULT.settings } };
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    /* private mode */
  }
}

export function completeLevel(save: SaveData, levelIndex: number, reward?: PlantId): SaveData {
  const next = { ...save, plants: [...save.plants], completed: [...save.completed] };
  const id = String(levelIndex);
  if (!next.completed.includes(id)) next.completed.push(id);
  next.unlocked = Math.max(next.unlocked, levelIndex + 1);
  if (reward && !next.plants.includes(reward)) next.plants.push(reward);
  writeSave(next);
  return next;
}
