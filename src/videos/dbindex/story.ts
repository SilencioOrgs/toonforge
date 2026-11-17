// 9-shot, 2812-frame (93.73 s @ 30 fps) timeline synced precisely to voice/dbindex_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2812;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 345, light: "day" },
  { id: 2, a: 345, b: 650, light: "day" },
  { id: 3, a: 650, b: 1125, light: "day" },
  { id: 4, a: 1125, b: 1252, light: "day" },
  { id: 5, a: 1252, b: 1556, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 6, a: 1556, b: 1922, light: "golden", sunAz: -20, sunEl: 12 },
  { id: 7, a: 1922, b: 2262, light: "day" },
  { id: 8, a: 2262, b: 2608, light: "day" },
  { id: 9, a: 2608, b: TOTAL, light: "golden", sunAz: -22, sunEl: 12 },
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 7: 8, 8: 8, 9: 8 };
export const FLASH_ATS = [1500, 1556];

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type DbIndexSim = {
  s1Slow: number;      // 8s timer climb in Shot 1
  s3Scan: number;      // Full Table Scan across row drawers in Shot 3
  s5Flood: number;     // Concurrent search overload in Shot 5
  s5Crash: number;     // Timeout & app crash at f = 1500
  btreeDrop: number;   // Golden B-Tree pyramid drops into center at f = 1600..1630
  btreeJump: number;   // 3-hop B-Tree traversal 2075..2170
  hit3ms: number;      // 3 ms target row hit at f = 2170+
  writeUpdate: number; // Write-update pulse on B-Tree in Shot 8
  followCta: number;   // FOLLOW FOR MORE! final visual beat at f = 2715+
};

export const simAt = (f: number): DbIndexSim => ({
  s1Slow: smooth((f - 25) / 140),
  s3Scan: smooth((f - 875) / 230),
  s5Flood: smooth((f - 1265) / 225),
  s5Crash: smooth((f - 1500) / 18),
  btreeDrop: smooth((f - 1600) / 30),
  btreeJump: smooth((f - 2075) / 95),
  hit3ms: smooth((f - 2170) / 25),
  writeUpdate: smooth((f - 2375) / 110),
  followCta: smooth((f - 2715) / 18),
});

type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.0014, fov = 40, roll = 0): CamS => {
  const k = (f - f0) * rate;
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 1500, amp: 0.038 },  // Shot 5 timeout crash
  { f: 1630, amp: 0.026 },  // Shot 6 B-Tree pyramid lands!
  { f: 2172, amp: 0.024 },  // Shot 7 3ms target hit!
];
const kickAt = (f: number) => {
  let k = 0;
  for (const x of KICKS) {
    const dt = f - x.f;
    if (dt >= 0 && dt < 8) k += x.amp * (1 - dt / 8) * (dt % 2 === 0 ? 1 : -1);
  }
  return k;
};

const KEYS: Record<number, Key[]> = {
  1: [{ f: 0, s: (f) => pushCam([0, 4.7, 22.0], [0, 2.3, -3.5], f, 0, 0.0012, 41) }],
  2: [{ f: 345, cut: true, s: (f) => pushCam([0, 5.8, 22.8], [0, 2.4, -3.5], f, 345, 0.0011, 41) }],
  3: [
    { f: 650, cut: true, s: (f) => pushCam([0.0, 4.7, 21.8], [0.0, 2.3, -3.5], f, 650, 0.0009, 41) },
    { f: 880, dur: 80, s: (f) => pushCam([0.25, 4.8, 21.8], [0.2, 2.4, -3.5], f, 880, 0.0008, 41) },
  ],
  4: [{ f: 1125, cut: true, s: (f) => pushCam([-1.2, 4.3, 18.8], [-1.0, 2.2, -2.8], f, 1125, 0.0012, 39) }],
  5: [{ f: 1252, cut: true, s: (f) => pushCam([0.8, 4.8, 21.6], [0.8, 2.4, -3.5], f, 1252, 0.0014, 41) }],
  6: [{ f: 1556, cut: true, s: (f) => pushCam([0, 4.5, 19.8], [0, 2.3, -3.5], f, 1556, 0.0013, 40) }],
  7: [{ f: 1922, cut: true, s: (f) => pushCam([0.0, 4.7, 21.8], [0.0, 2.3, -3.5], f, 1922, 0.0010, 41) }],
  8: [{ f: 2262, cut: true, s: (f) => pushCam([-0.4, 4.6, 20.8], [-0.2, 2.3, -3.5], f, 2262, 0.0012, 40) }],
  9: [{ f: 2608, cut: true, s: (f) => pushCam([0, 5.0, 22.4], [0, 2.3, -3.5], f, 2608, 0.0012, 41) }],
};

export const camAt = (id: number, f: number): CamS => {
  const list = KEYS[id];
  let cur = list[0].s(f);
  for (let i = 1; i < list.length; i++) {
    const k = list[i], dur = k.dur ?? 24;
    if (f < k.f) break;
    const prev = cur, next = k.s(f);
    if (k.cut || f >= k.f + dur) cur = next;
    else {
      const u = smoother((f - k.f) / dur);
      cur = {
        pos: [L(prev.pos[0], next.pos[0], u), L(prev.pos[1], next.pos[1], u), L(prev.pos[2], next.pos[2], u)],
        look: [L(prev.look[0], next.look[0], u), L(prev.look[1], next.look[1], u), L(prev.look[2], next.look[2], u)],
        fov: L(prev.fov, next.fov, u),
        roll: L(prev.roll, next.roll, u),
      };
    }
  }
  const kk = kickAt(f);
  if (kk) cur = { ...cur, roll: cur.roll + kk, pos: [cur.pos[0] + kk * 3.5, cur.pos[1] + Math.abs(kk) * 1.5, cur.pos[2]] };
  return cur;
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 9) return { cInf: 0 };
  return { cInf: 2.0 };
};
