export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const rel = path.replace(/^\//, "");
  return base.endsWith("/") ? `${base}${rel}` : `${base}/${rel}`;
}

const SPRITE_FILES: Record<string, string> = {
  sunflower: "sunflower.png",
  peashooter: "peashooter.png",
  snowpea: "snowpea.png",
  repeater: "repeater.png",
  wallnut: "wallnut.png",
  cherry: "cherry.png",
  potato: "potato.png",
  jalapeno: "jalapeno.png",
  puffshroom: "puffshroom.png",
  sunshroom: "sunshroom.png",
  fumeshroom: "fumeshroom.png",
  scaredyshroom: "scaredyshroom.png",
  zombie0: "zombie0.png",
  zombie1: "zombie1.png",
  zombie2: "zombie2.png",
  zombie3: "zombie3.png",
  cone: "cone.png",
  bucket: "bucket.png",
  flag: "flag.png",
  helmet: "helmet.png",
  newspaper: "newspaper.png",
  pole: "pole.png",
  door: "door.png",
  grave: "grave.png",
  sun: "sun.png",
  pea: "pea.png",
  icepea: "icepea.png",
  spore: "spore.png",
  mower: "mower.png",
  shovel: "shovel.png",
  boom: "boom.png",
  flame: "flame.png",
  lawnDay: "lawn_day.jpg",
  lawnNight: "lawn_night.jpg",
};

export const SPRITE_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(SPRITE_FILES).map(([key, file]) => [key, assetUrl(`sprites/${file}`)]),
);

export type Sprites = Record<string, HTMLImageElement>;

export async function loadSprites(): Promise<Sprites> {
  const pairs = await Promise.all(
    Object.entries(SPRITE_URLS).map(async ([key, url]) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      try {
        await img.decode();
      } catch {
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error(url));
        });
      }
      return [key, img] as const;
    }),
  );
  return Object.fromEntries(pairs);
}
