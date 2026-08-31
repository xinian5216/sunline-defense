export type PlantId =
  | "sunflower"
  | "peashooter"
  | "wallnut"
  | "cherry"
  | "snowpea"
  | "repeater"
  | "potato"
  | "jalapeno"
  | "puffshroom"
  | "sunshroom"
  | "fumeshroom"
  | "scaredyshroom";

export type ZombieId =
  | "basic"
  | "cone"
  | "bucket"
  | "flag"
  | "newspaper"
  | "football"
  | "pole"
  | "door";

export type Theme = "day" | "night";

export interface PlantDef {
  id: PlantId;
  name: string;
  desc: string;
  cost: number;
  recharge: number;
  hp: number;
  role: "sun" | "shoot" | "guard" | "bomb" | "mine";
  night: boolean;
  range: number;
  fire: number;
  dmg: number;
  slow?: number;
  burst?: number;
  pierce?: boolean;
  sunValue?: number;
  sunEvery?: number;
  armTime?: number;
  splash?: "tile3" | "row";
  sprite: string;
}

export interface ZombieDef {
  id: ZombieId;
  name: string;
  desc: string;
  hp: number;
  armor: number;
  armorKind: "none" | "cone" | "bucket" | "paper" | "door" | "helmet";
  speed: number;
  eat: number;
  spriteAcc?: string;
}

export interface SpawnEvent {
  t: number;
  type: ZombieId;
  row: number;
  flag?: boolean;
  huge?: boolean;
}

export interface LevelDef {
  id: string;
  name: string;
  chapter: string;
  theme: Theme;
  startSun: number;
  flags: number;
  graves: number;
  forced?: PlantId[];
  advice: PlantId[];
  reward?: PlantId;
  spawns: SpawnEvent[];
  note: string;
}

export interface Plant {
  id: number;
  type: PlantId;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  cd: number;
  prodT: number;
  age: number;
  fuse: number;
  armed: boolean;
  bursting: number;
  grown: boolean;
  hiding: boolean;
  shake: number;
}

export interface Zombie {
  id: number;
  type: ZombieId;
  row: number;
  x: number;
  hp: number;
  armor: number;
  eating: number | null;
  slow: number;
  hit: number;
  frame: number;
  frameT: number;
  vaulted: boolean;
  vaultT: number;
  angry: boolean;
  deadT: number;
  groanT: number;
}

export interface Projectile {
  id: number;
  kind: "pea" | "ice" | "spore";
  row: number;
  x: number;
  y: number;
  vx: number;
  dmg: number;
  slow: number;
  pierce: boolean;
  hit: Set<number>;
  life: number;
}

export interface SunDrop {
  id: number;
  x: number;
  y: number;
  ty: number;
  vy: number;
  value: number;
  life: number;
  fromPlant: boolean;
  collect: number;
}

export interface Mower {
  row: number;
  x: number;
  active: boolean;
  used: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  color: string;
}

export interface Grave {
  row: number;
  col: number;
}

export type Screen =
  | "title"
  | "adventure"
  | "select"
  | "play"
  | "almanac"
  | "settings"
  | "survival-select";

export interface SaveData {
  version: number;
  unlocked: number;
  plants: PlantId[];
  survivalBest: number;
  completed: string[];
  settings: { music: number; sfx: number; shake: boolean };
}
