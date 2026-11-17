// Expressive 9-pose Chibi character cast for Binary Search (Hero warm-brown + slow Linear cobalt-blue).
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { Actor, Fx, Pool } from "../paxsilica/cast";
import { fxBlob, INK, Pen } from "../paxsilica/toon";
import { V3 } from "../paxsilica/story";
import { ChibiExpr, ChibiFxKind, ChibiPose, ChibiVariant, drawChibi, drawChibiFx, resolveChibiFace } from "../chibi/chibiActor";
import { BinarySim, FPS } from "./story";

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : [480, 800, 0.8];

const fxCard = (p: Pen, text: string, bg: string, fg: string, badge?: string, badgeCol = "#2d89c8") => {
  p.poly([[6, 12], [506, 12], [506, 116], [6, 116]], bg, 6);
  const g = p.g;
  if (badge) {
    g.fillStyle = badgeCol; g.fillRect(14, 20, 120, 88);
    g.fillStyle = "#ffffff"; g.font = "900 22px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(badge, 74, 64);
    g.fillStyle = fg; g.font = "900 26px monospace"; g.textAlign = "left";
    g.fillText(text, 148, 64, 342);
  } else {
    g.fillStyle = fg; g.font = "900 28px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 256, 64, 464);
  }
};

export function stage(id: number, f: number, sim: BinarySim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const t = f / FPS;
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 5 || id === 6 || id === 8 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;

  const addChibi = (key: string, pos: V3, pose: ChibiPose, variant: ChibiVariant, facing: -1 | 1 = 1, expr: ChibiExpr = "neutral", seed = 1) => {
    const [x, y, z] = pos;
    const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1, z));
    const walkBucket = pose === "walk" ? Math.floor(f * 0.75) % 12 : 0;
    const faceId = resolveChibiFace(expr, f, seed);
    const breathBucket = pose === "walk" ? 0 : Math.round(Math.sin(f * 0.18 + seed) * 2);
    places.push({
      key: `chibi|${key}|${variant}|${pose}|${walkBucket}|${faceId}|${breathBucket}|${facing}`,
      x, y, z, scale: 1.15, size: tier(d),
      draw: (p) => drawChibi(p, pose, variant, facing, { f, expr, seed }),
    });
    fx.push({ key: `blob|${blobAlpha}`, cw: 64, ch: 64, x, y: 0.16, z, w: 1.05, h: 0.72, flat: true, draw: (p) => fxBlob(p, 64, 64, blobAlpha) });
  };

  const addChibiFx = (key: string, kind: ChibiFxKind, pos: V3, size: [number, number], opts: { flat?: boolean; seed?: number; progress?: number; flipX?: boolean } = {}) => {
    const [x, y, z] = pos;
    const [w, h] = size;
    const { flat = false, seed = 1, progress, flipX = false } = opts;
    const animBucket = kind === "sparkle" || kind === "question" ? Math.floor(f / 2) : f;
    fx.push({
      key: `cfx|${key}|${kind}|${flipX ? 1 : 0}|${animBucket}`,
      cw: 160, ch: 160, x, y, z, w, h, flat,
      draw: (p) => drawChibiFx(p, kind, 160, 160, { f, seed, progress, flipX }),
    });
  };

  // Parabolic jumping Hero cleanly on top of plaza stone surface (y = 0.14, z = 0.15)
  const FLOOR_Y = 0.14;
  let hx = id <= 2 ? 0.8 : id === 3 ? -1.6 : -3.0;
  let hy = FLOOR_Y;
  let jumping = false;
  if (id === 4) {
    const u = sim.jump50;
    hx = -3.0 + 3.0 * u;
    hy = FLOOR_Y + Math.sin(u * Math.PI) * 1.9;
    jumping = u > 0.05 && u < 0.95;
  } else if (id === 5) {
    hx = 0.0;
  } else if (id === 6) {
    const u = sim.jump75;
    hx = 0.0 + 2.7 * u;
    hy = FLOOR_Y + Math.sin(u * Math.PI) * 1.7;
    jumping = u > 0.05 && u < 0.95;
  } else if (id === 7) {
    const u1 = sim.hop63;
    const u2 = sim.hit73;
    if (u2 > 0.02) {
      hx = 0.9 + 0.9 * u2;
      hy = FLOOR_Y + Math.sin(u2 * Math.PI) * 1.4;
      jumping = u2 > 0.05 && u2 < 0.95;
    } else {
      hx = 2.7 - 1.8 * u1;
      hy = FLOOR_Y + Math.sin(u1 * Math.PI) * 1.5;
      jumping = u1 > 0.05 && u1 < 0.95;
    }
    if (sim.hit73 > 0.95) {
      hy = FLOOR_Y + Math.abs(Math.sin(t * 9)) * 0.55;
    }
  } else if (id === 8) {
    hx = 1.8;
  }

  let heroPose: ChibiPose = "idle";
  let heroExpr: ChibiExpr = "talk";
  let heroFacing: -1 | 1 = 1;
  if (id === 1) {
    heroPose = f < 90 ? "wave" : "present";
    heroExpr = f < 35 ? "wink" : "talk";
  } else if (id === 2) {
    heroPose = "present";
    heroExpr = (f % 90) < 45 ? "smile" : "talk";
  } else if (id === 3) {
    heroPose = sim.sortSnap > 0.65 ? "thumbs" : "think";
    heroExpr = sim.sortSnap > 0.65 ? "starry" : "sad";
  } else if (id === 4) {
    heroPose = jumping ? "walk" : sim.jump50 > 0.8 ? "point" : "present";
    heroExpr = jumping ? "wide" : sim.jump50 > 0.8 ? "laugh" : "talk";
  } else if (id === 5) {
    heroPose = "point";
    heroFacing = -1;
    heroExpr = sim.cutLeft > 0.25 ? "angry" : "talk";
  } else if (id === 6) {
    if (jumping) { heroPose = "walk"; heroExpr = "wide"; }
    else if (sim.cutRight > 0.35) { heroPose = "point"; heroFacing = 1; heroExpr = "sideeye"; }
    else { heroPose = "think"; heroExpr = "neutral"; }
  } else if (id === 7) {
    if (sim.hit73 > 0.75) { heroPose = "cheer"; heroExpr = (f % 24) < 12 ? "starry" : "laugh"; }
    else if (jumping) { heroPose = "walk"; heroFacing = sim.hit73 > 0.02 ? 1 : -1; heroExpr = "wide"; }
    else { heroPose = "point"; heroExpr = "talk"; }
  } else if (id === 8) {
    heroPose = "thumbs";
    heroExpr = (f % 75) < 25 ? "wink" : "starry";
  }

  addChibi("hero", [hx, hy, 0.15], heroPose, "brown", heroFacing, heroExpr, 3);

  // Pixel-art FX accents tightly anchored to Chibi head height (1.67 m standing, 1.32 m sitting) & floor props
  if (id === 1 && f >= 75 && f < 130) {
    addChibiFx("h_spk1", "sparkle", [hx + 0.45, 1.56, 0.22], [0.46, 0.46], { seed: 2 });
  } else if (id === 3) {
    if (sim.sortSnap <= 0.65) {
      addChibiFx("h_q3", "question", [hx + 0.44, 1.72, 0.22], [0.52, 0.56], { seed: 5 });
    } else {
      addChibiFx("h_spk3", "sparkle", [hx + 0.45, 1.56, 0.22], [0.48, 0.48], { seed: 7 });
    }
  } else if (id === 4 && sim.jump50 >= 0.84) {
    const rp = Math.min(1, (sim.jump50 - 0.84) / 0.16);
    addChibiFx("h_ring4", "ring", [hx, 0.165, 0.15], [1.4, 1.2], { flat: true, progress: rp });
    if (sim.jump50 > 0.9) addChibiFx("h_spk4", "sparkle", [hx + 0.45, 1.56, 0.22], [0.46, 0.46], { seed: 4 });
  } else if (id === 5 && sim.cutLeft > 0.15 && sim.cutLeft < 0.75) {
    addChibiFx("h_ring5", "ring", [hx - 0.95, 0.165, 0.15], [1.5, 1.3], { flat: true, progress: (sim.cutLeft - 0.15) / 0.6 });
  } else if (id === 6 && sim.jump75 >= 0.85 && sim.jump75 <= 0.99) {
    addChibiFx("h_ring6", "ring", [hx, 0.165, 0.15], [1.4, 1.2], { flat: true, progress: (sim.jump75 - 0.85) / 0.14 });
  } else if (id === 7 && sim.hit73 > 0.75) {
    addChibiFx("h_conf7", "confetti", [hx, 2.2, 0.18], [0.85, 0.78], { seed: 9 });
    addChibiFx("h_spk7", "sparkle", [hx - 0.46, 1.56, 0.22], [0.48, 0.48], { seed: 12 });
    if (sim.hit73 < 0.95) {
      addChibiFx("h_ring7", "ring", [hx, 0.165, 0.15], [1.55, 1.35], { flat: true, progress: (sim.hit73 - 0.75) / 0.2 });
    }
  } else if (id === 8) {
    addChibiFx("h_spk8", "sparkle", [hx - 0.46, 1.56, 0.22], [0.46, 0.46], { seed: 3 });
  }

  // Slow Linear Searcher in cobalt blue tee: walking smoothly across 30fps loop, then sitting exhausted in Shot 8!
  if (id === 1 || id === 2 || id === 4 || id === 8) {
    const lx = id === 8 ? -1.65 : id === 4 ? -2.4 + ((f - 700) / 340) * 0.65 : -2.4;
    const linPose: ChibiPose = id === 8 ? "sit" : id === 4 ? "walk" : id === 1 ? "walk" : "think";
    const linExpr: ChibiExpr = id === 8 ? ((f % 60) < 30 ? "tired" : "sad") : "neutral";
    addChibi("linear", [lx, FLOOR_Y, 1.3], linPose, "blue", 1, linExpr, 11);
    if (id === 8) {
      addChibiFx("lin_steam", "steam", [lx, 1.56, 1.35], [0.44, 0.48], { seed: 17 });
      fx.push({ key: "linLbl", cw: 512, ch: 128, x: -1.1, y: 2.38, z: 1.3, w: 1.85, h: 0.45, draw: (p) => fxCard(p, "LINEAR: #4 / 1M...", "#fff0d6", INK) });
    }
  }

  // Dynamic Diegetic Cards positioned cleanly above pillars & jumpers
  if (id === 1) {
    fx.push({ key: "b1", cw: 512, ch: 128, x: 0, y: 4.55, z: -4.2, w: 3.1, h: 0.72, draw: (p) => fxCard(p, "1,000,000 -> 20 STEPS!", "#eef4fa", INK, "TARGET") });
  } else if (id === 2) {
    fx.push({ key: "b2", cw: 512, ch: 128, x: 0, y: 4.55, z: -4.2, w: 3.0, h: 0.7, draw: (p) => fxCard(p, "BINARY SEARCH", "#2bb673", "#ffffff") });
  } else if (id === 3) {
    const sorted = sim.sortSnap > 0.65;
    fx.push({ key: `b3_${sorted ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.55, z: -4.2, w: 3.0, h: 0.7, draw: (p) => fxCard(p, sorted ? "SORTED: 01 -> 100 OK!" : "UNSORTED: WALA SA ORDER!", sorted ? "#2bb673" : "#d94545", "#ffffff") });
  } else if (id === 4) {
    const landed = sim.jump50 > 0.8;
    fx.push({ key: `b4_${landed ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.5, z: -4.2, w: 2.95, h: 0.68, draw: (p) => fxCard(p, landed ? "JUMP MID -> #50!" : "TARGET: #73", "#fff8dc", INK, landed ? "MID" : "FIND", "#2d89c8") });
  } else if (id === 5) {
    fx.push({ key: "b5", cw: 512, ch: 128, x: -0.3, y: 4.45, z: -4.2, w: 2.95, h: 0.68, draw: (p) => fxCard(p, "73 > 50! CUT 1..50", "#ffe6e6", INK, "CUT L", "#d94545") });
  } else if (id === 6) {
    const cutR = sim.cutRight > 0.4;
    fx.push({ key: `b6_${cutR ? 1 : 0}`, cw: 512, ch: 128, x: 1.4, y: 4.45, z: -4.2, w: 2.95, h: 0.68, draw: (p) => fxCard(p, cutR ? "73 < 75! CUT 75..100" : "NEW MID -> #75!", cutR ? "#ffe6e6" : "#fff8dc", INK, cutR ? "CUT R" : "MID", cutR ? "#d94545" : "#e07a34") });
  } else if (id === 7) {
    const boom = sim.hit73 > 0.8;
    fx.push({ key: `b7_${boom ? 1 : 0}`, cw: 512, ch: 128, x: 1.5, y: 4.45, z: -4.2, w: 2.85, h: 0.66, draw: (p) => fxCard(p, boom ? "BOOM! FOUND #73!" : "SPLIT AGAIN -> #63..", boom ? "#2bb673" : "#fff8dc", boom ? "#ffffff" : INK) });
  } else if (id === 8) {
    fx.push({ key: "b8", cw: 512, ch: 128, x: 0.9, y: 4.55, z: -4.2, w: 3.05, h: 0.72, draw: (p) => fxCard(p, "O(log n): 20 STEPS MAX!", "#2bb673", "#ffffff") });
  }

  return { places, fx };
}

export { Actor, Fx, Pool };
