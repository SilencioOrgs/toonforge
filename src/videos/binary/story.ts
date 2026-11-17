// 8-shot, 2699-frame (89.97 s @ 30 fps) timeline synced precisely to voice/binary_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2699;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 200, light: "day" },
  { id: 2, a: 200, b: 390, light: "day" },
  { id: 3, a: 390, b: 700, light: "day" },
  { id: 4, a: 700, b: 1040, light: "day" },
  { id: 5, a: 1040, b: 1420, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 6, a: 1420, b: 1850, light: "golden", sunAz: -20, sunEl: 12 },
  { id: 7, a: 1850, b: 2120, light: "day" },
  { id: 8, a: 2120, b: TOTAL, light: "golden", sunAz: -26, sunEl: 11 },
];

export const XFADE: Record<number, number> = { 5: 8, 7: 8, 8: 8 };
export const FLASH_AT = 200;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type BinarySim = {
  sortSnap: number;   // f480+ scrambled blocks snap into ascending staircase
  jump50: number;     // f930+ stickman leaps to MID #50
  cutLeft: number;    // f1165+ left half (#01..#50) sinks/discards
  jump75: number;     // f1495+ stickman leaps to NEW MID #75
  cutRight: number;   // f1675+ right half (#75..#100) sinks/discards
  hop63: number;      // f1865+ quick hop to #63
  hit73: number;      // f1930+ BOOM! Lands on #73 and swings prize open
};

export const simAt = (f: number): BinarySim => ({
  sortSnap: smooth((f - 480) / 55),
  jump50: smooth((f - 930) / 45),
  cutLeft: smooth((f - 1165) / 45),
  jump75: smooth((f - 1495) / 45),
  cutRight: smooth((f - 1675) / 45),
  hop63: smooth((f - 1865) / 30),
  hit73: smooth((f - 1930) / 30),
});

type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.0018, fov = 40, roll = 0): CamS => {
  const k = (f - f0) * rate;
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 975, amp: 0.022 },   // lands at #50
  { f: 1540, amp: 0.022 },  // lands at #75
  { f: 1945, amp: 0.032 },  // BOOM! #73 hit!
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
    { f: 0, s: (f) => pushCam([0, 4.6, 21.8], [0, 2.5, -4.0], f, 0, 0.0016, 41) },
  ],
  2: [
    { f: 200, cut: true, s: (f) => pushCam([0, 7.2, 23.0], [0, 2.5, -4.5], f, 200, 0.0016, 42) },
  ],
  3: [
    { f: 390, cut: true, s: (f) => pushCam([0, 4.8, 21.6], [0, 2.5, -4.5], f, 390, 0.0016, 41) },
  ],
  4: [
    { f: 700, cut: true, s: (f) => pushCam([-0.8, 4.4, 21.0], [-0.2, 2.4, -4.0], f, 700, 0.0016, 40) },
    { f: 910, dur: 28, s: (f) => pushCam([0, 4.4, 20.6], [0, 2.4, -4.2], f, 910, 0.0018, 40) },
  ],
  5: [
    { f: 1040, cut: true, s: (f) => pushCam([0.2, 4.6, 19.6], [0, 2.4, -4.2], f, 1040, 0.0016, 40) },
  ],
  6: [
    { f: 1420, cut: true, s: (f) => pushCam([1.4, 4.4, 18.8], [1.1, 2.4, -4.2], f, 1420, 0.0018, 40) },
  ],
  7: [
    { f: 1850, cut: true, s: (f) => pushCam([1.5, 4.2, 17.2], [1.4, 2.4, -4.5], f, 1850, 0.002, 39, -0.02) },
  ],
  8: [
    { f: 2120, cut: true, s: (f) => pushCam([0, 5.4, 24.8], [0, 2.5, -4.0], f, 2120, 0.0014, 41) },
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
  if (kk) cur = { ...cur, roll: cur.roll + kk, pos: [cur.pos[0] + kk * 3.5, cur.pos[1] + Math.abs(kk) * 1.5, cur.pos[2]] };
  return cur;
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 8) return { cInf: 0 };
  return { cInf: 2.0 };
};
