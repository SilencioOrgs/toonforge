// Lit flat 2D cast for "No to Pax Silica" & Aeta Land Rights short.
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { NOINK } from "../paxsilica/ink";
import { Actor, Fx, Pool, SU } from "../paxsilica/cast";
import { AETA, AETA_ELDER, bodyFront, ENGINEER, Expr, fxAlert, fxBlob, OFFICIAL, Pen, Prop, WORKER } from "../paxsilica/toon";
import { FPS, NoPaxSim } from "./story";
import { V3 } from "../paxsilica/story";

export { Actor, Fx, Pool, SU };

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : d < 22 ? [480, 800, 0.8] : [240, 400, 0.4];

const blinkAt = (seed: number, f: number) => ((f + seed * 13) % (45 + (seed * 17) % 42)) < 4;

export function stage(id: number, f: number, sim: NoPaxSim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const t = f / FPS;
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 1 || id === 4 || id === 5 || id === 8 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;

  const addActor = (key: string, pos: V3, o: ReturnType<typeof WORKER>, opts: {
    expr?: Expr; mode?: "stroll" | "stand"; phase?: number; prop?: Prop; facing?: -1 | 0 | 1; wave?: number; seed?: number; scale?: number;
  } = {}) => {
    const [x, y, z] = pos;
    const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1, z));
    const seed = opts.seed ?? 1;
    const blink = blinkAt(seed, f);
    const sx = cam.sun.dot(cam.right), sy = -cam.sun.y;
    const l2d = Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
    const ph = opts.mode === "stroll" ? Math.round(((opts.phase ?? 0) % 1) * 16) / 16 : 0;
    const wv = opts.wave !== undefined ? Math.round(opts.wave * 10) / 10 : undefined;
    const expr = opts.expr ?? "neutral";
    places.push({
      key: `${key}|${expr}|${opts.mode ?? "stand"}|${ph}|${blink ? 1 : 0}|${opts.prop ?? "n"}|${wv ?? "n"}|${l2d.toFixed(2)}`,
      x, y, z, scale: opts.scale ?? 1, size: tier(d),
      draw: (p) => bodyFront(p, o, { ...opts, phase: ph, blink, light: l2d }),
    });
    fx.push({ key: `blob|${blobAlpha}`, cw: 64, ch: 64, x, y: y + 0.02, z, w: 1.0, h: 0.7, flat: true, draw: (p) => fxBlob(p, 64, 64, blobAlpha) });
  };

  // Surveyors & planners on industrial side (Shots 2-6)
  if (id >= 2 && id <= 6) {
    addActor("eng0", [-10.5, 0, 4.5], ENGINEER(0), { expr: "neutral", prop: "clipboard", facing: 1, seed: 5 });
    addActor("wk0", [-6.5, 0, 8.2], WORKER(0), { expr: "neutral", prop: "box", facing: 1, seed: 2 });
  }

  // Aeta farmers, community & youth allies in Capas foothills
  const aetaExpr: Expr = id === 1 ? "smile" : id === 3 || id === 4 ? "nervous" : id === 5 || id === 6 ? "stern" : id === 7 ? "relief" : "neutral";
  const isRally = id === 5 || id === 6;
  const shift = isRally ? -2.4 : 0;
  const waveA = id === 5 ? Math.sin(t * 5.2) * 0.55 : undefined;

  addActor("aeta0", [15.8 + shift, 0, 1.8], AETA(0), { expr: aetaExpr, prop: isRally ? "signLand" : "hoe", facing: -1, seed: 11, wave: waveA });
  addActor("aeta1", [16.4 + shift, 0, -1.6], AETA(1), { expr: id === 3 ? "shock" : aetaExpr, prop: isRally ? "signWater" : null, facing: -1, seed: 12 });
  addActor("aeta2", [17.8 + shift * 0.7, 0.04, 3.8], AETA(2), { expr: aetaExpr, prop: isRally ? "signLand" : null, facing: -1, seed: 13 });
  addActor("ally0", [15.4 + shift, 0, -4.0], WORKER(2), { expr: isRally ? "stern" : "neutral", prop: isRally ? "signWater" : null, facing: -1, seed: 15 });
  addActor("aeta3", [19.4, 0.15, -7.2], AETA(3), { expr: id >= 7 ? "smile" : "nervous", facing: -1, seed: 14 });

  // Elder & BCDA/NCIP official
  const elderX = id === 7 ? 11.2 : id === 5 ? 13.6 : 16.2;
  addActor("elder", [elderX, 0, 0.2], AETA_ELDER, { expr: id === 7 ? "smile" : id === 1 ? "smile" : "stern", facing: -1, seed: 19 });
  if (id === 7) {
    addActor("official", [9.2, 0, 0.2], OFFICIAL, { expr: "smile", prop: "clipboard", facing: 1, seed: 23 });
  }

  // Symbolic 2D alerts
  if (id === 3) {
    fx.push({ key: "fxQuest", cw: 128, ch: 128, x: 16.0, y: 2.9 + Math.sin(t * 4) * 0.12, z: 0.2, w: 0.9, h: 0.9, draw: (p) => fxAlert(p, "quest") });
  } else if (id === 4 || id === 5) {
    fx.push({ key: "fxWarn", cw: 128, ch: 128, x: 14.2, y: 3.15 + Math.sin(t * 6) * 0.12, z: -0.2, w: 0.95, h: 0.95, draw: (p) => fxAlert(p, "warn") });
  } else if (id === 7 && sim.safeguard > 0.5) {
    fx.push({ key: "fxCheck", cw: 128, ch: 128, x: 10.2, y: 2.95, z: 0.2, w: 0.9, h: 0.9, draw: (p) => fxAlert(p, "check") });
  }

  return { places, fx };
}

export const NOINK_LAYER = NOINK;
