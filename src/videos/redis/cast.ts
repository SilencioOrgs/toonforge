// Expressive 30fps Chibi cast + pixel-art FX + diegetic system metric cards for Caching (Redis).
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { Actor, Fx, Pool } from "../paxsilica/cast";
import { fxBlob, INK, Pen } from "../paxsilica/toon";
import { V3 } from "../paxsilica/story";
import { ChibiExpr, ChibiFxKind, ChibiPose, ChibiVariant, drawChibi, drawChibiFx, resolveChibiFace } from "../chibi/chibiActor";
import { FPS, RedisSim } from "./story";

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
    g.fillStyle = fg; g.font = "900 25px monospace"; g.textAlign = "left";
    g.fillText(text, 162, 64, 328);
  } else {
    g.fillStyle = fg; g.font = "900 27px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 256, 64, 464);
  }
};

const fxMeter = (p: Pen, label: string, pct: number, barCol: string) => {
  p.poly([[8, 12], [392, 12], [392, 118], [8, 118]], "#fffdf7", 6);
  const g = p.g;
  g.fillStyle = INK; g.font = "900 24px monospace"; g.textAlign = "center";
  g.fillText(label, 200, 46);
  g.fillStyle = "#e3e7ee"; g.fillRect(28, 66, 344, 30);
  g.fillStyle = barCol; g.fillRect(28, 66, Math.round(344 * Math.min(1, Math.max(0.02, pct))), 30);
  g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(28, 66, 344, 30);
};

export function stage(id: number, f: number, sim: RedisSim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
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

  // ---- Hero Chibi (brown tee: Dev / Architect) ----
  let hx = -1.6;
  const hy = FLOOR_Y;
  let heroPose: ChibiPose = "present";
  let heroFacing: -1 | 1 = 1;
  let heroExpr: ChibiExpr = "talk";

  if (id === 1) {
    hx = -1.9;
    heroPose = f < 75 ? "wave" : sim.s1Crash > 0.15 ? "present" : "point";
    heroExpr = sim.s1Crash > 0.15 ? ((f % 16) < 8 ? "wide" : "grimace") : f < 40 ? "wink" : "talk";
  } else if (id === 2) {
    hx = -1.8;
    heroPose = f < 340 ? "present" : "point";
    heroExpr = "talk";
  } else if (id === 3) {
    if (f < 585) {
      hx = -2.2; heroPose = f < 500 ? "present" : "think"; heroExpr = "talk";
    } else if (f < 735) {
      hx = -2.2 + 2.4 * sim.s3Go; heroPose = "walk"; heroExpr = "neutral";
    } else if (f < 795) {
      hx = 0.2; heroPose = "think"; heroExpr = "neutral";
    } else {
      hx = 0.2 - 1.6 * sim.s3Back; heroPose = "walk"; heroFacing = -1; heroExpr = "neutral";
    }
  } else if (id === 4) {
    hx = -1.8; heroPose = "thumbs"; heroExpr = (f % 45) < 18 ? "smile" : "talk";
  } else if (id === 5) {
    hx = -2.0; heroPose = sim.s5Crash > 0.2 ? "present" : "point";
    heroExpr = sim.s5Crash > 0.2 ? "grimace" : sim.s5Flood > 0.5 ? "wide" : "talk";
  } else if (id === 6) {
    hx = -1.7; heroPose = sim.redisDrop > 0.85 ? "point" : "present";
    heroExpr = sim.redisDrop > 0.85 ? "starry" : "talk";
  } else if (id === 7) {
    hx = -1.75; heroPose = sim.missSave > 0.5 ? "thumbs" : "present";
    heroExpr = sim.missSave > 0.6 ? "wink" : "talk";
  } else if (id === 8) {
    hx = -1.55; heroPose = f > 1920 ? "cheer" : "point";
    heroExpr = f > 1920 ? ((f % 24) < 12 ? "starry" : "laugh") : "talk";
  } else if (id === 9) {
    hx = -1.65;
    if (f < 2270) { heroPose = "present"; heroExpr = "talk"; }
    else { heroPose = f > 2400 ? "thumbs" : "cheer"; heroExpr = f > 2430 ? "wink" : "starry"; }
  }

  addChibi("hero", [hx, hy, 0.25], heroPose, "brown", heroFacing, heroExpr, 3);

  // ---- Database Worker Chibi (blue tee: DB Server Worker) ----
  let dx = 2.2;
  let dbPose: ChibiPose = "idle";
  let dbExpr: ChibiExpr = "neutral";
  if (id === 1) {
    dbPose = sim.s1Crash > 0.15 ? "sit" : "idle";
    dbExpr = sim.s1Crash > 0.15 ? "sad" : sim.s1Surge > 0.5 ? "grimace" : "neutral";
    if (sim.s1Surge > 0.45) addChibiFx("db_stm1", "steam", [dx, dbPose === "sit" ? 1.56 : 1.88, 0.3], [0.46, 0.48], { seed: 7 });
  } else if (id === 2) {
    dbPose = "sit"; dbExpr = "tired";
    addChibiFx("db_stm2", "steam", [dx, 1.56, 0.3], [0.46, 0.48], { seed: 9 });
  } else if (id === 3) {
    dbPose = "think";
    addChibiFx("db_q3", "question", [dx - 0.46, 1.72, 0.32], [0.52, 0.56], { seed: 4, flipX: true });
  } else if (id === 4) {
    dbPose = "idle"; dbExpr = "smile";
  } else if (id === 5) {
    dbPose = sim.s5Crash > 0.2 ? "sit" : "idle";
    dbExpr = sim.s5Crash > 0.2 ? "sad" : sim.s5Flood > 0.35 ? "angry" : "grimace";
    const stmY = dbPose === "sit" ? 1.56 : 1.88;
    addChibiFx("db_stm5a", "steam", [dx - 0.12, stmY, 0.34], [0.48, 0.50], { seed: 2 });
    if (sim.s5Flood > 0.45) addChibiFx("db_stm5b", "steam", [dx + 0.16, stmY + 0.08, 0.3], [0.44, 0.46], { seed: 14 });
  } else if (id === 6) {
    dbPose = "idle"; dbExpr = sim.redisDrop > 0.85 ? "wide" : "tired";
    if (sim.redisDrop >= 0.82 && sim.redisDrop < 0.99) {
      addChibiFx("red_ring", "ring", [0, 0.165, -3.4], [2.4, 2.0], { flat: true, progress: (sim.redisDrop - 0.82) / 0.17 });
      addChibiFx("red_spk", "sparkle", [0.85, 2.65, -2.5], [0.64, 0.64], { seed: 8 });
    }
  } else if (id === 7) {
    dbPose = sim.missGo > 0.7 && sim.missSave < 0.3 ? "think" : "idle";
    dbExpr = sim.missSave > 0.5 ? "smile" : "neutral";
    if (sim.missSave >= 0.55) {
      addChibiFx("save_spk", "sparkle", [0.85, 2.65, -2.5], [0.64, 0.64], { seed: 6 });
    }
  } else if (id === 8) {
    dbPose = "thumbs"; dbExpr = (f % 48) < 24 ? "wink" : "starry";
    addChibiFx("hit_spk", "sparkle", [-0.78, 2.68, -2.5], [0.62, 0.62], { seed: 11 });
    addChibiFx("hit_conf", "confetti", [hx, 2.15, 0.3], [0.82, 0.76], { seed: 15 });
  } else if (id === 9) {
    if (f < 2270) {
      dbPose = "thumbs"; dbExpr = "smile";
      if (sim.ttlCycle > 0.65 && sim.ttlCycle < 0.92) {
        addChibiFx("ttl_spk", "sparkle", [0.85, 2.68, -2.5], [0.62, 0.62], { seed: 5 });
      }
    } else {
      dbPose = "cheer"; dbExpr = (f % 32) < 16 ? "laugh" : "starry";
      addChibiFx("fin_conf_h", "confetti", [hx, 2.15, 0.3], [0.82, 0.76], { seed: 21 });
      addChibiFx("fin_conf_d", "confetti", [dx, 2.15, 0.3], [0.82, 0.76], { seed: 29 });
      addChibiFx("fin_spk", "sparkle", [hx + 0.48, 1.56, 0.32], [0.46, 0.46], { seed: 3 });
    }
  }
  addChibi("dbworker", [dx, hy, 0.25], dbPose, "blue", -1, dbExpr, 11);

  // ---- Dynamic Hero thought/sparkle FX ----
  if (id === 3 && f < 585 && f >= 500) {
    addChibiFx("hq3", "question", [hx + 0.45, 1.72, 0.32], [0.52, 0.56], { seed: 3 });
  } else if (id === 4) {
    addChibiFx("hspk4", "sparkle", [hx + 0.46, 1.56, 0.32], [0.48, 0.48], { seed: 1 });
  }

  // ---- Database CPU Load Meter & Diegetic Timeline Cards ----
  const cpuPct =
    id === 1 ? (sim.s1Crash > 0.15 ? 1.0 : 0.25 + 0.75 * sim.s1Surge)
    : id === 2 ? 0.95
    : id === 3 ? 0.45
    : id === 4 ? 0.18
    : id === 5 ? (sim.s5Crash > 0.15 ? 1.0 : 0.35 + 0.65 * sim.s5Flood)
    : id === 6 ? 0.12
    : id === 7 ? (sim.missGo > 0.5 && sim.missSave < 0.4 ? 0.25 : 0.08)
    : 0.03;
  const cpuCol = cpuPct > 0.8 ? "#d93838" : cpuPct > 0.4 ? "#e69628" : "#2bb673";
  const cpuText = cpuPct >= 0.98 ? "DB CPU: 100% CRASH!" : cpuPct < 0.06 ? "DB CPU: 2% CHILL" : `DB CPU: ${Math.round(cpuPct * 100)}%`;
  const meterBucket = Math.round(cpuPct * 20);
  fx.push({ key: `cpu|${meterBucket}`, cw: 400, ch: 128, x: 2.35, y: 4.35, z: -3.4, w: 1.95, h: 0.62, draw: (p) => fxMeter(p, cpuText, cpuPct, cpuCol) });

  if (id === 1) {
    const crashed = sim.s1Crash > 0.15;
    fx.push({
      key: `c1_${crashed ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.9, z: -3.2, w: 3.2, h: 0.72,
      draw: (p) => fxCard(p, crashed ? "DATABASE CRASH! (500)" : "10,000 USERS SABAY!", crashed ? "#ffe3e3" : "#eef4fa", INK, crashed ? "ERROR" : "VIRAL", crashed ? "#d93838" : "#2d89c8"),
    });
  } else if (id === 2) {
    fx.push({ key: "c2", cw: 512, ch: 128, x: 0, y: 4.9, z: -3.2, w: 3.1, h: 0.72, draw: (p) => fxCard(p, "NO CACHING IN APP", "#d93838", "#ffffff") });
  } else if (id === 3) {
    const step = sim.s3Back > 0.2 ? 2 : sim.s3Go > 0.2 ? 1 : 0;
    const msgs = ["QUERY: TOP 10 SELLERS", "DB: SCAN & SORT ROWS...", "RETURN ANSWER TO SERVER"];
    fx.push({ key: `c3_${step}`, cw: 512, ch: 128, x: 0, y: 4.9, z: -3.2, w: 3.25, h: 0.72, draw: (p) => fxCard(p, msgs[step], "#fff8dc", INK, "SLOW", "#e07a34") });
  } else if (id === 4) {
    fx.push({ key: "c4", cw: 512, ch: 128, x: -0.9, y: 4.15, z: -2.4, w: 2.85, h: 0.66, draw: (p) => fxCard(p, "1 USER -> 200 ms OK", "#2bb673", "#ffffff") });
  } else if (id === 5) {
    const down = sim.s5Crash > 0.15;
    fx.push({
      key: `c5_${down ? 1 : 0}`, cw: 512, ch: 128, x: 0.4, y: 4.9, z: -3.2, w: 3.25, h: 0.72,
      draw: (p) => fxCard(p, down ? "SYSTEM DOWN! OVERLOAD" : "10,000 SAME QUERIES!", "#ffe3e3", INK, "10K REQ", "#d93838"),
    });
  } else if (id === 6) {
    const landed = sim.redisDrop > 0.85;
    fx.push({
      key: `c6_${landed ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.8, z: -3.2, w: 3.15, h: 0.72,
      draw: (p) => fxCard(p, landed ? "REDIS: IN-MEMORY CACHE" : "ANG FIX: ADD REDIS!", "#d82c20", "#ffffff"),
    });
  } else if (id === 7) {
    const saved = sim.missSave > 0.55;
    fx.push({
      key: `c7_${saved ? 1 : 0}`, cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.25, h: 0.72,
      draw: (p) => fxCard(p, saved ? "SAVED IN REDIS RAM!" : "REQ #1 -> DB (MISS)", saved ? "#e6fff0" : "#fff8dc", INK, saved ? "CACHED" : "MISS", saved ? "#2bb673" : "#e07a34"),
    });
  } else if (id === 8) {
    fx.push({
      key: "c8", cw: 512, ch: 128, x: -0.4, y: 4.85, z: -3.2, w: 3.35, h: 0.74,
      draw: (p) => fxCard(p, "9,999 USERS -> 2 ms!", "#2bb673", "#ffffff", "HIT!", "#147a49"),
    });
  } else if (id === 9) {
    if (f < 2270) {
      const sec = Math.max(0, Math.round(60 * (1 - Math.min(1, sim.ttlCycle / 0.65))));
      const ref = sim.ttlCycle >= 0.65;
      fx.push({
        key: `c9_${ref ? "R" : sec}`, cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.2, h: 0.72,
        draw: (p) => fxCard(p, ref ? "TTL 0s -> AUTO REFRESH!" : `TTL EXPIRES IN ${sec}s`, ref ? "#e6fff0" : "#fff8dc", INK, "TTL", "#d82c20"),
      });
    } else {
      fx.push({
        key: "c9_fin", cw: 512, ch: 128, x: 0, y: 4.85, z: -3.2, w: 3.35, h: 0.74,
        draw: (p) => fxCard(p, "I-CACHE MO NA! (2 ms)", "#2bb673", "#ffffff", "REDIS", "#d82c20"),
      });
    }
  }

  return { places, fx };
}

export { Actor, Fx, Pool };
