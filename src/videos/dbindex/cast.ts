// Expressive 30fps Chibi cast + pixel-art FX + diegetic cards for Database Indexing (Full Table Scan vs B-Tree Index).
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { Actor, Fx, Pool } from "../paxsilica/cast";
import { fxBlob, INK, Pen } from "../paxsilica/toon";
import { V3 } from "../paxsilica/story";
import { ChibiExpr, ChibiFxKind, ChibiPose, ChibiVariant, drawChibi, drawChibiFx, resolveChibiFace } from "../chibi/chibiActor";
import { DbIndexSim } from "./story";

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : [480, 800, 0.8];

const fxCard = (p: Pen, text: string, bg: string, fg: string, badge?: string, badgeCol = "#2d89c8") => {
  p.poly([[6, 12], [506, 12], [506, 116], [6, 116]], bg, 6);
  const g = p.g;
  if (badge) {
    g.fillStyle = badgeCol; g.fillRect(14, 20, 134, 88);
    g.fillStyle = "#ffffff"; g.font = "900 22px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(badge, 81, 64);
    g.fillStyle = fg; g.font = "900 24px monospace"; g.textAlign = "left";
    g.fillText(text, 162, 64, 328);
  } else {
    g.fillStyle = fg; g.font = "900 27px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 256, 64, 464);
  }
};

const fxMeter = (p: Pen, label: string, pct: number, barCol: string) => {
  p.poly([[8, 12], [392, 12], [392, 118], [8, 118]], "#fffdf7", 6);
  const g = p.g;
  g.fillStyle = INK; g.font = "900 23px monospace"; g.textAlign = "center";
  g.fillText(label, 200, 46);
  g.fillStyle = "#e3e7ee"; g.fillRect(28, 66, 344, 30);
  g.fillStyle = barCol; g.fillRect(28, 66, Math.round(344 * Math.min(1, Math.max(0.02, pct))), 30);
  g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(28, 66, 344, 30);
};

export function stage(id: number, f: number, sim: DbIndexSim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 5 || id === 6 || id === 9 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;
  const FLOOR_Y = 0.14;

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

  // ---- Hero Chibi (brown tee) ----
  let hx = -1.75;
  const hy = FLOOR_Y;
  let heroPose: ChibiPose = "present";
  let heroFacing: -1 | 1 = 1;
  let heroExpr: ChibiExpr = "talk";

  if (id === 1) {
    hx = -1.75;
    heroPose = f < 179 ? "present" : "point";
    heroExpr = f < 179 ? (sim.s1Slow > 0.7 ? "wide" : "talk") : "talk";
  } else if (id === 2) {
    hx = -1.75;
    heroPose = "present";
    heroExpr = f < 395 ? "wink" : "talk";
  } else if (id === 3) {
    if (f >= 680 && f < 820) {
      hx = -1.55; heroPose = "think"; heroExpr = "neutral";
      addChibiFx("h_q3", "question", [hx + 0.45, 1.72, 0.32], [0.52, 0.56], { seed: 5 });
    } else if (f >= 820) {
      hx = -1.35; heroPose = "point"; heroExpr = "talk";
    } else {
      hx = -1.7; heroPose = "present"; heroExpr = "talk";
    }
  } else if (id === 4) {
    hx = -1.65;
    heroPose = "thumbs";
    heroExpr = (f % 45) < 20 ? "smile" : "talk";
    addChibiFx("h_spk4", "sparkle", [hx + 0.46, 1.56, 0.32], [0.48, 0.48], { seed: 2 });
  } else if (id === 5) {
    hx = -1.8;
    heroPose = sim.s5Crash > 0.2 ? "present" : "point";
    heroExpr = sim.s5Crash > 0.2 ? "grimace" : sim.s5Flood > 0.5 ? "wide" : "talk";
  } else if (id === 6) {
    hx = -1.7;
    heroPose = sim.btreeDrop > 0.85 ? "point" : "present";
    heroExpr = sim.btreeDrop > 0.85 ? "starry" : "talk";
  } else if (id === 7) {
    hx = -1.65;
    if (sim.hit3ms > 0.5) {
      heroPose = "cheer";
      heroExpr = (f % 24) < 12 ? "starry" : "laugh";
      addChibiFx("h_conf7", "confetti", [hx, 2.15, 0.3], [0.82, 0.76], { seed: 9 });
      addChibiFx("h_spk7", "sparkle", [hx + 0.48, 1.56, 0.32], [0.48, 0.48], { seed: 4 });
    } else {
      heroPose = "point";
      heroExpr = "talk";
    }
  } else if (id === 8) {
    hx = -1.7;
    heroPose = f > 2500 ? "thumbs" : "present";
    heroExpr = f > 2500 ? "wink" : "talk";
  } else if (id === 9) {
    hx = -1.7;
    if (f < 2715) {
      heroPose = "thumbs";
      heroExpr = "starry";
    } else {
      heroPose = "cheer";
      heroExpr = (f % 30) < 15 ? "wink" : "laugh";
      addChibiFx("h_conf9", "confetti", [hx, 2.15, 0.3], [0.82, 0.76], { seed: 13 });
      addChibiFx("h_spk9", "sparkle", [hx + 0.48, 1.56, 0.32], [0.46, 0.46], { seed: 6 });
    }
  }

  addChibi("hero", [hx, hy, 0.25], heroPose, "brown", heroFacing, heroExpr, 3);

  // ---- DB Worker Chibi (blue tee) ----
  let dx = 2.2;
  let dbFacing: -1 | 1 = -1;
  let dbPose: ChibiPose = "idle";
  let dbExpr: ChibiExpr = "neutral";

  if (id === 1) {
    dbPose = "sit"; dbExpr = "tired";
    addChibiFx("db_stm1", "steam", [dx, 1.56, 0.3], [0.46, 0.48], { seed: 7 });
  } else if (id === 2) {
    dbPose = "think";
    addChibiFx("db_q2", "question", [dx - 0.46, 1.72, 0.32], [0.52, 0.56], { seed: 4, flipX: true });
  } else if (id === 3) {
    if (f >= 875 && sim.s3Scan < 0.94) {
      const scanWave = Math.sin(sim.s3Scan * Math.PI * 3);
      dx = 1.75 + scanWave * 0.75;
      dbFacing = Math.cos(sim.s3Scan * Math.PI * 3) >= 0 ? 1 : -1;
      dbPose = "walk";
      dbExpr = "neutral";
    } else if (sim.s3Scan >= 0.94) {
      dx = 2.2; dbPose = "sit"; dbExpr = "tired";
      addChibiFx("db_stm3", "steam", [dx, 1.56, 0.3], [0.46, 0.48], { seed: 11 });
    } else {
      dbPose = "think";
      addChibiFx("db_q3", "question", [dx - 0.46, 1.72, 0.32], [0.52, 0.56], { seed: 8, flipX: true });
    }
  } else if (id === 4) {
    dbPose = "idle"; dbExpr = "smile";
  } else if (id === 5) {
    dbPose = sim.s5Crash > 0.2 ? "sit" : "idle";
    dbExpr = sim.s5Crash > 0.2 ? "sad" : sim.s5Flood > 0.35 ? "angry" : "grimace";
    const stmY = dbPose === "sit" ? 1.56 : 1.88;
    addChibiFx("db_stm5a", "steam", [dx - 0.12, stmY, 0.34], [0.48, 0.50], { seed: 2 });
    if (sim.s5Flood > 0.45) addChibiFx("db_stm5b", "steam", [dx + 0.16, stmY + 0.08, 0.3], [0.44, 0.46], { seed: 14 });
  } else if (id === 6) {
    dbPose = "idle";
    dbExpr = sim.btreeDrop > 0.85 ? "smile" : "wide";
    if (f >= 1624 && f < 1646) {
      addChibiFx("bt_ring", "ring", [-0.1, 0.165, -2.55], [2.1, 1.7], { flat: true, progress: (f - 1624) / 22 });
      addChibiFx("bt_spk", "sparkle", [0.85, 2.65, -2.5], [0.64, 0.64], { seed: 8 });
    }
  } else if (id === 7) {
    dbPose = "thumbs";
    dbExpr = (f % 48) < 24 ? "wink" : "starry";
  } else if (id === 8) {
    dbPose = f > 2460 ? "thumbs" : "think";
    dbExpr = f > 2460 ? "smile" : "neutral";
  } else if (id === 9) {
    dbPose = "cheer";
    dbExpr = (f % 32) < 16 ? "laugh" : "starry";
    addChibiFx("db_conf9", "confetti", [-0.1, 3.65, -2.5], [0.92, 0.85], { seed: 29 });
  }

  addChibi("dbworker", [dx, hy, 0.25], dbPose, "blue", dbFacing, dbExpr, 11);

  // ---- DB CPU / DISK Meter (safely inside right frame at x = 2.35, y = 4.35, z = -3.4) ----
  const cpuPct =
    id === 1 ? 0.35 + 0.45 * sim.s1Slow
    : id === 2 ? 0.55
    : id === 3 ? 0.4 + 0.48 * sim.s3Scan
    : id === 4 ? 0.14
    : id === 5 ? (sim.s5Crash > 0.15 ? 1.0 : 0.38 + 0.62 * sim.s5Flood)
    : id === 6 ? 0.12
    : id === 7 ? (sim.hit3ms > 0.4 ? 0.03 : 0.08)
    : id === 8 ? 0.18
    : 0.03;
  const cpuCol = cpuPct > 0.8 ? "#d93838" : cpuPct > 0.4 ? "#e69628" : "#2bb673";
  const cpuText = cpuPct >= 0.98 ? "DB DISK: 100% CRASH!" : cpuPct <= 0.05 ? "DB DISK: 3% CHILL" : `DB DISK: ${Math.round(cpuPct * 100)}%`;
  const meterBucket = Math.round(cpuPct * 20);
  fx.push({ key: `cpu|${meterBucket}`, cw: 400, ch: 128, x: 2.35, y: 4.35, z: -3.4, w: 1.95, h: 0.62, draw: (p) => fxMeter(p, cpuText, cpuPct, cpuCol) });

  // ---- Diegetic Cards (x = 0, y = 4.85, z = -3.2) ----
  if (id === 1) {
    if (f < 179) {
      fx.push({ key: "d1a", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "SEARCH BAR -> 8.0 SECONDS?!", "#fff8dc", INK, "SLOW", "#e07a34") });
    } else {
      fx.push({ key: "d1b", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "UNIQUE SEARCHES != REDIS CACHE", "#ffe3e3", INK, "NO CACHE", "#d93838") });
    }
  } else if (id === 2) {
    fx.push({ key: "d2", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.15, h: 0.72, draw: (p) => fxCard(p, "1,000,000 ROWS: NO INDEX", "#d93838", "#ffffff") });
  } else if (id === 3) {
    if (f < 875) {
      fx.push({ key: "d3a", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "UNSORTED -> FULL TABLE SCAN", "#fff8dc", INK, "SCAN", "#e07a34") });
    } else {
      fx.push({ key: "d3b", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "SCAN: ROW #1 -> #2 -> #3 -> 1M", "#fff8dc", INK, "O(n)", "#e07a34") });
    }
  } else if (id === 4) {
    fx.push({ key: "d4", cw: 512, ch: 128, x: -0.9, y: 4.2, z: -2.5, w: 2.95, h: 0.68, draw: (p) => fxCard(p, "500 ROWS -> FAST (NO PROBLEM)", "#2bb673", "#ffffff") });
  } else if (id === 5) {
    const down = sim.s5Crash > 0.15;
    fx.push({
      key: `d5_${down ? 1 : 0}`, cw: 512, ch: 128, x: 0.3, y: 4.85, z: -3.2, w: 3.25, h: 0.72,
      draw: (p) => fxCard(p, down ? "TIMEOUT! APP CRASHED (504)" : "DISK & CPU CRUSHED! (1M SCAN)", "#ffe3e3", INK, "OVERLOAD", "#d93838"),
    });
  } else if (id === 6) {
    const landed = sim.btreeDrop > 0.85;
    fx.push({
      key: `d6_${landed ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72,
      draw: (p) => fxCard(p, landed ? "B-TREE: SORTED LOOKUP TREE" : "ANG FIX: ADD DATABASE INDEX!", "#e6fff0", INK, "INDEX", "#2bb673"),
    });
  } else if (id === 7) {
    const hit = sim.hit3ms > 0.3;
    fx.push({
      key: `d7_${hit ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72,
      draw: (p) => fxCard(p, hit ? "FOUND IN 3 MILLISECONDS!" : "B-TREE JUMP: 3 TO 4 STEPS!", hit ? "#2bb673" : "#e6fff0", hit ? "#ffffff" : INK, hit ? "3 ms!" : "O(log n)", "#147a49"),
    });
  } else if (id === 8) {
    if (f < 2508) {
      fx.push({ key: "d8a", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "READS: FAST | WRITES: SLOWER", "#fff8dc", INK, "RULE", "#e07a34") });
    } else {
      fx.push({ key: "d8b", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, "INDEX SEARCHED COLUMNS ONLY!", "#eef4fa", INK, "TIP", "#2d89c8") });
    }
  } else if (id === 9) {
    fx.push({
      key: "d9a", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.74,
      draw: (p) => fxCard(p, "MISSING AN INDEX! (3 ms FIX)", "#2bb673", "#ffffff", "INDEX", "#147a49"),
    });
    if (f >= 2715) {
      fx.push({
        key: "d9cta", cw: 512, ch: 128, x: 0, y: 0.52, z: 1.45, w: 2.95, h: 0.66,
        draw: (p) => fxCard(p, "FOLLOW FOR MORE VIDEOS!", "#fffdf6", INK, "FOLLOW +", "#d82c20"),
      });
    }
  }

  return { places, fx };
}

export { Actor, Fx, Pool };
