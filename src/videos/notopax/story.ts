// 8-shot, 60.0 s (1800 frames @ 30 fps) timeline for the "No to Pax Silica" & Aeta Land Rights visual short.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 1800;

export type ShotDef = {
  id: number; a: number; b: number; light: Light;
  badge: string; title: string; accent: string;
  sunAz?: number; sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 180, light: "golden", badge: "CAPAS, TARLAC", title: "Aeta Ancestral Lands & Farms", accent: "#e8a838", sunAz: -35, sunEl: 13 },
  { id: 2, a: 180, b: 390, light: "day", badge: "PROPOSED 4,000 ACRES", title: "New Clark City Tech Zone (2026)", accent: "#2d89c8" },
  { id: 3, a: 390, b: 630, light: "day", badge: "AETA LEADERS' WARNING", title: "Consultation & Eviction Fears", accent: "#e88835" },
  { id: 4, a: 630, b: 870, light: "golden", badge: "COMMUNITY CONCERNS", title: "Local Water & Power Grid Strain", accent: "#d9534f", sunAz: -20, sunEl: 9 },
  { id: 5, a: 870, b: 1140, light: "golden", badge: "\"NO TO PAX SILICA\" RALLIES", title: "Aeta, Farmer & Youth Coalitions", accent: "#d9534f", sunAz: -18, sunEl: 10 },
  { id: 6, a: 1140, b: 1380, light: "day", badge: "PUBLIC SCRUTINY", title: "Petitions & Calls for Review", accent: "#d97336" },
  { id: 7, a: 1380, b: 1620, light: "day", badge: "OFFICIAL RESPONSE (BCDA · NCIP)", title: "PH Law · Buildable Zones · Homes Spared", accent: "#2b6cb0" },
  { id: 8, a: 1620, b: 1800, light: "golden", badge: "WHAT LIES AHEAD", title: "Ancestral Rights vs. Tech Corridor", accent: "#e8a838", sunAz: -32, sunEl: 12 },
];

export const XFADE: Record<number, number> = { 2: 8, 4: 8, 6: 8, 8: 8 };
export const FLASH_AT = 390;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type NoPaxSim = {
  zoneGlow: number;
  fencePush: number;
  excavator: number;
  waterLvl: number;
  protest: number;
  petitionLvl: number;
  safeguard: number;
  scaleTilt: number;
};

export const simAt = (f: number): NoPaxSim => {
  const zoneGlow = smooth((f - 190) / 80);
  const pushIn = smooth((f - 390) / 140);
  const pullBack = smooth((f - 1380) / 70);
  const fencePush = pushIn * (1 - pullBack);
  const excavator = smooth((f - 390) / 70) * (1 - smooth((f - 1380) / 50));
  const dip = smooth((f - 630) / 170);
  const recover = smooth((f - 1420) / 140);
  const waterLvl = 1.0 - 0.68 * dip * (1 - 0.85 * recover);
  const protest = smooth((f - 870) / 50) * (1 - smooth((f - 1380) / 30));
  const petitionLvl = smooth((f - 1140) / 150);
  const safeguard = smooth((f - 1380) / 60);
  const scaleTilt = 0.14 * Math.sin((f - 1620) * 0.05) * (1 - smooth((f - 1740) / 40));
  return { zoneGlow, fencePush, excavator, waterLvl, protest, petitionLvl, safeguard, scaleTilt };
};

type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.0022, fov = 40, roll = 0): CamS => {
  const k = (f - f0) * rate;
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 390, amp: 0.025 },
  { f: 885, amp: 0.018 },
  { f: 1390, amp: 0.018 },
];
const kickAt = (f: number) => {
  let k = 0;
  for (const x of KICKS) {
    const dt = f - x.f;
    if (dt >= 0 && dt < 7) k += x.amp * (1 - dt / 7) * (dt % 2 === 0 ? 1 : -1);
  }
  return k;
};

const KEYS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => pushCam([13, 6.2, 22], [22, 2.2, 1.5], f, 0, 0.002, 40) },
    { f: 100, dur: 35, s: (f) => pushCam([11, 3.6, 13.5], [19, 1.8, 1.0], f, 100, 0.0022, 38) },
  ],
  2: [
    { f: 180, cut: true, s: (f) => pushCam([-2, 16, 44], [3, 2.0, 0], f, 180, 0.002, 42) },
    { f: 300, dur: 32, s: (f) => pushCam([4, 11, 30], [7, 1.8, 0], f, 300, 0.0022, 40) },
  ],
  3: [
    { f: 390, cut: true, s: (f) => pushCam([8.5, 4.4, 19], [14.5, 1.8, 0.5], f, 390, 0.0022, 40, -0.04) },
    { f: 520, dur: 28, s: (f) => pushCam([10.0, 3.2, 13.5], [15.5, 1.7, 0.2], f, 520, 0.0024, 37) },
  ],
  4: [
    { f: 630, cut: true, s: (f) => pushCam([9.5, 4.5, 13.5], [18.5, 2.5, -5.8], f, 630, 0.0022, 38) },
    { f: 760, dur: 26, s: (f) => pushCam([11.5, 3.8, 8.5], [18.5, 2.7, -6.2], f, 760, 0.0024, 36) },
  ],
  5: [
    { f: 870, cut: true, s: (f) => pushCam([7.5, 3.6, 15.0], [14.0, 2.2, 0.0], f, 870, 0.0024, 38, 0.05) },
    { f: 1010, dur: 26, s: (f) => pushCam([8.8, 2.9, 10.5], [14.0, 2.1, -0.5], f, 1010, 0.0025, 36) },
  ],
  6: [
    { f: 1140, cut: true, s: (f) => pushCam([6.5, 5.8, 17.5], [13.0, 2.6, 1.5], f, 1140, 0.0022, 39) },
    { f: 1270, dur: 24, s: (f) => pushCam([8.2, 4.8, 13.5], [13.0, 2.8, 1.8], f, 1270, 0.0024, 38) },
  ],
  7: [
    { f: 1380, cut: true, s: (f) => pushCam([11.5, 4.5, 19], [9.0, 2.0, -0.5], f, 1380, 0.0022, 40) },
    { f: 1505, dur: 26, s: (f) => pushCam([12.0, 3.6, 15.5], [9.5, 1.9, -0.2], f, 1505, 0.0024, 39) },
  ],
  8: [
    { f: 1620, cut: true, s: (f) => pushCam([7, 21, 56], [6.5, 4.0, -1], f, 1620, 0.0018, 44) },
  ],
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
  if (kk) cur = { ...cur, roll: cur.roll + kk, pos: [cur.pos[0] + kk * 4, cur.pos[1] + Math.abs(kk) * 2, cur.pos[2]] };
  return cur;
};

export const dofAt = (f: number): { cInf: number; focus?: (f: number) => V3 } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 8) return { cInf: 0 };
  if (id === 1 || id === 6 || id === 7) return { cInf: 9 };
  return { cInf: 12 };
};
