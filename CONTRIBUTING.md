# 贡献指南

欢迎修 bug、加关卡、补素材。改之前请先开 Issue 对一下方向，避免和正在做的功能撞车。

## 开发

```bash
npm install
npm run dev
npm run typecheck
```

请保持 `npm run build` 与 `npm run typecheck` 通过。

## 加一种植物

1. 在 `src/game/types.ts` 的 `PlantId` 里加 id
2. 在 `src/game/catalog.ts` 的 `PLANTS` 与 `PLANT_ORDER` 里写数值和说明
3. 把像素图放到 `public/sprites/<id>.png`（建议约 128×128，透明底）
4. 在 `src/game/sprites.ts` 的 `SPRITE_FILES` 里登记
5. 如有特殊行为（穿透、爆炸、埋设），在 `src/game/sim.ts` 里按现有 `role` 扩展，能复用就不要新分支

## 加一种行尸

同上：`ZombieId` → `ZOMBIES` / `ZOMBIE_ORDER` → 帽子/道具图 → `sim.ts` 里的护甲、跳跃、暴怒等。

## 加一关

在 `catalog.ts` 的 `LEVELS` 数组末尾追加。`compile()` 的波次格式：

```ts
{ t: 16, g: [["basic", 3, 2]] }                 // t 秒开始，3 只园丁尸，间隔 2 秒
{ t: 58, flag: true, g: [["basic", 5, 1.6]] }    // 旗帜波
{ t: 128, flag: true, huge: true, g: [...] }     // 大波提示
```

`reward` 是通关解锁的植物 id。夜间关设 `theme: "night"`，并考虑蘑菇类建议阵容。

## 代码风格

- TypeScript 严格模式，不要加 `any`
- 不要把调试 `console.log` 留在主循环里
- 不要提交 `node_modules/`、`dist/`、`release/`
- 新素材请标明来源；不要使用受版权保护的原版 PvZ 贴图或音频

## 提交

- 用现在时短句：`Fix pole-vault landing on empty tiles`
- 一个 PR 做一件事
- 若改了手感（伤害、冷却、波次），在 PR 里写你怎么试的
