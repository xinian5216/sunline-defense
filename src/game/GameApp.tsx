import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, ChevronLeft, Settings, Volume2, VolumeX } from "lucide-react";
import { LEVELS, PLANT_ORDER, PLANTS, SURVIVAL, ZOMBIE_ORDER, ZOMBIES } from "./catalog";
import { Engine } from "./engine";
import { GameAudio } from "./audio";
import { completeLevel, loadSave, writeSave } from "./save";
import { loadSprites, assetUrl, type Sprites } from "./sprites";
import type { LevelDef, PlantId, SaveData, Screen } from "./types";

const audio = new GameAudio();

export function GameApp() {
  const [screen, setScreen] = useState<Screen>("title");
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [sprites, setSprites] = useState<Sprites | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState<LevelDef | null>(null);
  const [seeds, setSeeds] = useState<PlantId[]>([]);
  const [survival, setSurvival] = useState(false);
  const [almanacTab, setAlmanacTab] = useState<"plant" | "zombie">("plant");
  const [almanacId, setAlmanacId] = useState<string>("sunflower");

  useEffect(() => {
    loadSprites()
      .then(setSprites)
      .catch(() => setErr("素材加载失败，请刷新"));
  }, []);

  useEffect(() => {
    audio.setMusic(save.settings.music);
    audio.setSfx(save.settings.sfx);
  }, [save.settings.music, save.settings.sfx]);

  const unlockAudio = () => audio.unlock();

  const persist = useCallback((next: SaveData) => {
    setSave(next);
    writeSave(next);
  }, []);

  const openLevel = (lv: LevelDef, surv: boolean) => {
    unlockAudio();
    audio.click();
    setLevel(lv);
    setSurvival(surv);
    if (lv.forced) {
      setSeeds(lv.forced);
      setScreen("play");
    } else {
      const pick = lv.advice.filter((id) => save.plants.includes(id)).slice(0, 8);
      setSeeds(pick.length ? pick : save.plants.slice(0, 8));
      setScreen(surv ? "survival-select" : "select");
    }
  };

  return (
    <div
      className={`relative bg-bg text-fg ${screen === "play" ? "h-dvh overflow-hidden" : "min-h-dvh overflow-y-auto"}`}
      onPointerDown={unlockAudio}
    >
      {screen === "title" && (
        <Title
          save={save}
          onAdventure={() => {
            audio.click();
            setScreen("adventure");
          }}
          onSurvival={() => openLevel({ ...SURVIVAL, theme: save.unlocked >= 8 ? "night" : "day" }, true)}
          onAlmanac={() => {
            audio.click();
            setScreen("almanac");
          }}
          onSettings={() => {
            audio.click();
            setScreen("settings");
          }}
        />
      )}
      {screen === "adventure" && (
        <Adventure
          save={save}
          onBack={() => setScreen("title")}
          onPick={(i) => openLevel(LEVELS[i]!, false)}
        />
      )}
      {(screen === "select" || screen === "survival-select") && level && (
        <PlantSelect
          save={save}
          level={level}
          seeds={seeds}
          setSeeds={setSeeds}
          onBack={() => setScreen(screen === "survival-select" ? "title" : "adventure")}
          onStart={() => {
            audio.click();
            setScreen("play");
          }}
        />
      )}
      {screen === "play" && level && (
        sprites ? (
        <Play
          level={level}
          seeds={seeds}
          sprites={sprites}
          save={save}
          survival={survival}
          onSave={persist}
          onExit={() => {
            audio.stopMusic();
            setScreen(survival ? "title" : "adventure");
          }}
        />
        ) : (
          <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
            <p className="font-display text-2xl tracking-wide">{err ?? "正在整装花园…"}</p>
          </div>
        )
      )}
      {screen === "almanac" && (
        <Almanac
          tab={almanacTab}
          setTab={setAlmanacTab}
          id={almanacId}
          setId={setAlmanacId}
          unlocked={save.plants}
          seen={save.unlocked}
          onBack={() => setScreen("title")}
        />
      )}
      {screen === "settings" && (
        <SettingsPane
          save={save}
          onChange={persist}
          onBack={() => setScreen("title")}
        />
      )}
    </div>
  );
}

function Title({
  save,
  onAdventure,
  onSurvival,
  onAlmanac,
  onSettings,
}: {
  save: SaveData;
  onAdventure: () => void;
  onSurvival: () => void;
  onAlmanac: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] [@media(orientation:landscape)_and_(max-height:500px)]:justify-start">
      <img
        src={assetUrl("sprites/lawn_day.jpg")}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/55 to-bg" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center py-2 text-center">
        <p className="text-[11px] tracking-[0.35em] text-muted sm:text-sm">PIXEL GARDEN DEFENSE</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,12vh,4.5rem)] leading-none text-fg">阳光防线</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted [@media(orientation:landscape)_and_(max-height:500px)]:hidden">
          种植十二种植物，挡住十二关行尸。点阳光、排阵型、守住前院与月夜。
        </p>
        <div className="mt-5 flex w-full flex-col gap-2.5 sm:mt-8 sm:gap-3">
          <BigBtn onClick={onAdventure}>冒险模式</BigBtn>
          <BigBtn onClick={onSurvival} tone="ghost">
            生存模式
            {save.survivalBest > 0 ? ` · 最佳 ${save.survivalBest} 击杀` : ""}
          </BigBtn>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <BigBtn onClick={onAlmanac} tone="ghost">
              <BookOpen className="mr-2 inline size-4" />
              图鉴
            </BigBtn>
            <BigBtn onClick={onSettings} tone="ghost">
              <Settings className="mr-2 inline size-4" />
              设置
            </BigBtn>
          </div>
        </div>
        <p className="mt-5 text-xs text-faint sm:mt-8">
          进度保存在本机 · 已解锁 {save.unlocked + 1} / {LEVELS.length} 关
        </p>
        <p className="mt-2 text-xs text-faint sm:hidden">横屏游玩更顺手 · 先点种子再点草地</p>
      </div>
    </div>
  );
}

function Adventure({
  save,
  onBack,
  onPick,
}: {
  save: SaveData;
  onBack: () => void;
  onPick: (i: number) => void;
}) {
  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-3xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <TopBar title="冒险模式" onBack={onBack} />
      <p className="mt-2 shrink-0 text-sm text-muted">沿路径推进。通关会解锁新植物与下一关。</p>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8 [-webkit-overflow-scrolling:touch]">
        <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((lv, i) => {
          const locked = i > save.unlocked;
          const done = save.completed.includes(String(i));
          return (
            <button
              key={lv.id}
              disabled={locked}
              onClick={() => onPick(i)}
              className="min-h-16 touch-manipulation rounded-xl border border-border bg-surface p-4 text-left transition hover:bg-surface-2 disabled:opacity-40"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xl">{lv.id}</span>
                <span className="text-xs text-muted">{lv.chapter}</span>
              </div>
              <p className="mt-1 text-base">{lv.name}</p>
              <p className="mt-1 text-xs text-muted">
                {lv.theme === "night" ? "夜间" : "白天"} · {lv.flags} 面旗帜
                {done ? " · 已通关" : locked ? " · 未解锁" : " · 可挑战"}
              </p>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function PlantSelect({
  save,
  level,
  seeds,
  setSeeds,
  onBack,
  onStart,
}: {
  save: SaveData;
  level: LevelDef;
  seeds: PlantId[];
  setSeeds: (s: PlantId[]) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const pool = PLANT_ORDER.filter((id) => save.plants.includes(id));
  const toggle = (id: PlantId) => {
    audio.click();
    if (seeds.includes(id)) setSeeds(seeds.filter((s) => s !== id));
    else if (seeds.length < 8) setSeeds([...seeds, id]);
  };
  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-3xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <TopBar title={`${level.id}  ${level.name}`} onBack={onBack} />
      <p className="mt-2 shrink-0 text-sm text-muted">{level.note}</p>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [-webkit-overflow-scrolling:touch]">
      <p className="text-xs tracking-wide text-faint">出战栏 · {seeds.length} / 8</p>
      <div className="mt-2 flex min-h-20 flex-wrap gap-2 rounded-xl border border-border bg-surface p-3">
        {seeds.map((id) => (
          <SeedCard key={id} id={id} onClick={() => toggle(id)} active />
        ))}
      </div>
      <p className="mt-5 text-xs tracking-wide text-faint">已解锁植物</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pool.map((id) => (
          <SeedCard key={id} id={id} onClick={() => toggle(id)} active={seeds.includes(id)} />
        ))}
      </div>
      </div>
      <button
        disabled={seeds.length === 0}
        onClick={onStart}
        className="mt-3 h-12 shrink-0 touch-manipulation rounded-lg bg-primary text-base font-medium text-primary-fg disabled:opacity-40"
      >
        开始战斗
      </button>
    </div>
  );
}

function usePortrait() {
  const read = () => typeof window !== "undefined" && window.innerHeight > window.innerWidth + 64;
  const [portrait, setPortrait] = useState(read);
  useEffect(() => {
    const on = () => setPortrait(read());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return portrait;
}

function RotateHint({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/92 px-6 text-center">
      <div
        className="mb-5 size-16 rounded-xl border-2 border-primary"
        style={{ transform: "rotate(90deg)" }}
        aria-hidden
      />
      <h2 className="font-display text-3xl">请把手机横过来</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
        草坪是横版的。横屏后种子栏和格子会大很多，点起来更准。
      </p>
      <button
        className="mt-8 h-11 rounded-lg border border-border bg-surface px-4 text-sm text-muted"
        onClick={onSkip}
      >
        仍要竖着玩
      </button>
    </div>
  );
}

function SeedCard({ id, onClick, active }: { id: PlantId; onClick: () => void; active?: boolean }) {
  const p = PLANTS[id];
  return (
    <button
      onClick={onClick}
      className={`flex min-h-16 touch-manipulation flex-col items-center rounded-lg border p-2 transition ${
        active ? "border-primary bg-surface-2" : "border-border bg-surface"
      }`}
    >
      <img src={assetUrl(`sprites/${p.sprite}.png`)} alt="" className="h-14 w-14 object-contain" />
      <span className="mt-1 text-xs">{p.name}</span>
      <span className="text-[11px] text-muted">{p.cost}</span>
    </button>
  );
}

function Play({
  level,
  seeds,
  sprites,
  save,
  survival,
  onSave,
  onExit,
}: {
  level: LevelDef;
  seeds: PlantId[];
  sprites: Sprites;
  save: SaveData;
  survival: boolean;
  onSave: (s: SaveData) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const [paused, setPaused] = useState(false);
  const [end, setEnd] = useState<"win" | "lose" | null>(null);
  const [kills, setKills] = useState(0);
  const [allowPortrait, setAllowPortrait] = useState(false);
  const portrait = usePortrait();
  const idx = LEVELS.findIndex((l) => l.id === level.id);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const e = new Engine(c, level, seeds, sprites, audio, survival);
    e.shakeEnabled = save.settings.shake;
    eng.current = e;
    e.onPause = () => setPaused(true);
    e.onWin = () => {
      setKills(e.sim.kills);
      setEnd("win");
      if (!survival && idx >= 0) {
        saveRef.current(completeLevel(loadSave(), idx, level.reward));
      }
    };
    e.onLose = () => {
      setKills(e.sim.kills);
      setEnd("lose");
      if (survival) {
        const s = loadSave();
        s.survivalBest = Math.max(s.survivalBest, e.sim.kills);
        writeSave(s);
        saveRef.current(s);
      }
    };
    e.start();
    return () => {
      e.destroy();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, seeds, sprites, survival, idx]);

  useEffect(() => {
    document.documentElement.classList.add("is-play");
    return () => document.documentElement.classList.remove("is-play");
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          className="touch-none select-none"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
        />
      </div>
      <p className="hidden px-3 py-2 text-center text-xs text-faint md:block">
        点选种子再点草地种植 · 点阳光收集 · 1-8 快捷键 · X 铲子 · F 加速 · Esc 暂停
      </p>
      {portrait && !allowPortrait && !end && (
        <RotateHint onSkip={() => setAllowPortrait(true)} />
      )}
      {paused && !end && (
        <Modal>
          <h2 className="font-display text-3xl">暂停</h2>
          <p className="mt-2 text-sm text-muted">{level.name}</p>
          <div className="mt-6 flex flex-col gap-3">
            <BigBtn
              onClick={() => {
                setPaused(false);
                eng.current?.resume();
              }}
            >
              继续
            </BigBtn>
            <BigBtn tone="ghost" onClick={onExit}>
              退出关卡
            </BigBtn>
          </div>
        </Modal>
      )}
      {end && (
        <Modal>
          <h2 className="font-display text-3xl">{end === "win" ? "花园守住了" : "防线失守"}</h2>
          <p className="mt-2 text-sm text-muted">
            {end === "win" && !survival && level.reward
              ? `解锁植物：${PLANTS[level.reward].name}`
              : `击退 ${kills} 个行尸`}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <BigBtn onClick={onExit}>{end === "win" && !survival ? "返回地图" : "离开"}</BigBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Almanac({
  tab,
  setTab,
  id,
  setId,
  unlocked,
  seen,
  onBack,
}: {
  tab: "plant" | "zombie";
  setTab: (t: "plant" | "zombie") => void;
  id: string;
  setId: (s: string) => void;
  unlocked: PlantId[];
  seen: number;
  onBack: () => void;
}) {
  const plant = PLANTS[id as PlantId];
  const zombie = ZOMBIES[id as keyof typeof ZOMBIES];
  const entry = tab === "plant" ? plant : zombie;
  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-3xl flex-col overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <TopBar title="图鉴" onBack={onBack} />
      <div className="mt-4 flex gap-2">
        <TabBtn active={tab === "plant"} onClick={() => { setTab("plant"); setId("sunflower"); }}>
          植物
        </TabBtn>
        <TabBtn active={tab === "zombie"} onClick={() => { setTab("zombie"); setId("basic"); }}>
          行尸
        </TabBtn>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {(tab === "plant" ? PLANT_ORDER : ZOMBIE_ORDER).map((pid) => {
          const known = tab === "plant" ? unlocked.includes(pid as PlantId) : seen > 0;
          return (
            <button
              key={pid}
              onClick={() => setId(pid)}
              className={`rounded-lg border p-2 ${id === pid ? "border-primary bg-surface-2" : "border-border bg-surface"}`}
            >
              <img
                src={
                  tab === "plant"
                    ? assetUrl(`sprites/${pid}.png`)
                    : pid === "basic"
                      ? assetUrl("sprites/zombie0.png")
                      : assetUrl(`sprites/${ZOMBIES[pid as keyof typeof ZOMBIES].spriteAcc ?? "zombie0"}.png`)
                }
                alt=""
                className={`mx-auto h-12 w-12 object-contain ${known ? "" : "opacity-30"}`}
              />
            </button>
          );
        })}
      </div>
      {entry && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="font-display text-2xl">{entry.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{entry.desc}</p>
          {"cost" in entry && (
            <p className="mt-3 text-sm text-fg">
              阳光 {entry.cost} · 冷却 {entry.recharge} 秒 · 生命 {entry.hp}
            </p>
          )}
          {"speed" in entry && (
            <p className="mt-3 text-sm text-fg">
              生命 {entry.hp + entry.armor} · 移速 {entry.speed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPane({
  save,
  onChange,
  onBack,
}: {
  save: SaveData;
  onChange: (s: SaveData) => void;
  onBack: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const set = (patch: Partial<SaveData["settings"]>) => {
    const next = { ...save, settings: { ...save.settings, ...patch } };
    onChange(next);
    audio.setMusic(next.settings.music);
    audio.setSfx(next.settings.sfx);
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <TopBar title="设置" onBack={onBack} />
      <label className="mt-8 text-sm text-muted">音乐</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={save.settings.music}
        onChange={(e) => set({ music: Number(e.target.value) })}
        className="mt-2 w-full accent-primary"
      />
      <label className="mt-6 text-sm text-muted">音效</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={save.settings.sfx}
        onChange={(e) => set({ sfx: Number(e.target.value) })}
        className="mt-2 w-full accent-primary"
      />
      <button
        className="mt-8 flex h-12 items-center justify-between rounded-lg border border-border bg-surface px-4"
        onClick={() => set({ shake: !save.settings.shake })}
      >
        <span>画面震动</span>
        <span className="text-muted">{save.settings.shake ? "开" : "关"}</span>
      </button>
      <button
        className="mt-3 flex h-12 items-center justify-between rounded-lg border border-border bg-surface px-4"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          audio.setMuted(next);
        }}
      >
        <span>静音</span>
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <p className="mt-8 text-xs leading-relaxed text-faint">
        震动可在系统「减少动态效果」中一并关闭。进度保存在本机。
      </p>
    </div>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-[env(safe-area-inset-top)]">
      <button
        onClick={onBack}
        className="flex size-11 items-center justify-center rounded-lg border border-border bg-surface"
        aria-label="返回"
      >
        <ChevronLeft className="size-5" />
      </button>
      <h1 className="font-display text-2xl">{title}</h1>
    </div>
  );
}

function BigBtn({
  children,
  onClick,
  tone = "solid",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={
        tone === "solid"
          ? "flex h-12 min-h-12 touch-manipulation items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-fg transition hover:opacity-90"
          : "flex h-12 min-h-12 touch-manipulation items-center justify-center rounded-lg border border-border bg-surface px-4 text-base font-medium text-fg transition hover:bg-surface-2"
      }
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 flex-1 rounded-lg text-sm ${active ? "bg-primary text-primary-fg" : "border border-border bg-surface"}`}
    >
      {children}
    </button>
  );
}

function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 px-5">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-lg">
        {children}
      </div>
    </div>
  );
}
