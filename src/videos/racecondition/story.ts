// 8-shot, 1790-frame (59.67 s @ 30 fps) timeline synced precisely to voice/race_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 1790;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 210, light: "day" },
  { id: 2, a: 210, b: 336, light: "day" },
  { id: 3, a: 336, b: 540, light: "day" },
  { id: 4, a: 540, b: 738, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 5, a: 738, b: 1015, light: "day" },
  { id: 6, a: 1015, b: 1165, light: "day" },
  { id: 7, a: 1165, b: 1435, light: "golden", sunAz: -22, sunEl: 10 },
  { id: 8, a: 1435, b: TOTAL, light: "day" },
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 7: 8, 8: 8 };
export const FLASH_AT = 210;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type RaceSim = {
  doubleConfirm: number; // f80+ both phones confirm
  splitSteps: number;    // f336-540 Check & Save separated
  raceBurst: number;     // f548-730 both packets race through Check
  atomicMerge: number;   // f741+ Check+Save fuse into 1 atomic gate
  rowOneWin: number;     // f1021+ User A locks seat (Row=1)
  rowZeroLose: number;   // f1080+ User B hits locked gate (Row=0)
  uniqueLock: number;    // f1168+ heavy iron lock drops on DB
  bugReject: number;     // f1293+ red bug spark blocked by DB shield
  friendlyMsg: number;   // f1620+ friendly message kiosk lights up
};

export const simAt = (f: number): RaceSim => ({
  doubleConfirm: smooth((f - 78) / 18),
  splitSteps: smooth((f - 340) / 30) * (1 - smooth((f - 740) / 30)),
  raceBurst: smooth((f - 548) / 110),
  atomicMerge: smooth((f - 741) / 45),
  rowOneWin: smooth((f - 1018) / 35),
  rowZeroLose: smooth((f - 1078) / 30),
  uniqueLock: smooth((f - 1170) / 45),
  bugReject: smooth((f - 1295) / 60),
  friendlyMsg: smooth((f - 1590) / 40),
});

type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.0022, fov = 40, roll = 0): CamS => {
  const k = (f - f0) * rate;
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 80, amp: 0.022 },
  { f: 550, amp: 0.028 },
  { f: 750, amp: 0.024 },
  { f: 1180, amp: 0.026 },
  { f: 1330, amp: 0.022 },
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
    { f: 0, s: (f) => pushCam([0, 3.8, 17.5], [0, 1.8, 0], f, 0, 0.0018, 42) },
    { f: 145, dur: 28, s: (f) => pushCam([0, 3.2, 14.0], [0, 1.7, 0], f, 145, 0.0022, 40, -0.04) },
  ],
  2: [
    { f: 210, cut: true, s: (f) => pushCam([-3.5, 9.5, 24], [0, 2.2, -5], f, 210, 0.002, 42) },
  ],
  3: [
    { f: 336, cut: true, s: (f) => pushCam([6.5, 5.2, 16.5], [-1.5, 2.2, -5.5], f, 336, 0.0022, 39) },
    { f: 475, dur: 26, s: (f) => pushCam([8.5, 6.2, 18.0], [-1.5, 2.4, -5.5], f, 475, 0.0022, 40) },
  ],
  4: [
    { f: 540, cut: true, s: (f) => pushCam([0, 6.8, 17.5], [0, 1.8, -1.5], f, 540, 0.0024, 40, 0.05) },
    { f: 650, dur: 26, s: (f) => pushCam([0, 3.8, 10.5], [0, 1.8, 0.2], f, 650, 0.0026, 38, -0.04) },
  ],
  5: [
    { f: 738, cut: true, s: (f) => pushCam([-5.5, 4.8, 15.5], [-0.5, 2.2, -5.5], f, 738, 0.0022, 39) },
    { f: 890, dur: 28, s: (f) => pushCam([0, 4.4, 13.5], [0, 2.3, -5.5], f, 890, 0.0024, 38) },
  ],
  6: [
    { f: 1015, cut: true, s: (f) => pushCam([-3.5, 3.0, 9.5], [-1.8, 1.8, 0.4], f, 1015, 0.0024, 37) },
    { f: 1075, dur: 24, s: (f) => pushCam([3.5, 3.0, 9.5], [2.4, 1.8, 0.4], f, 1075, 0.0024, 37) },
  ],
  7: [
    { f: 1165, cut: true, s: (f) => pushCam([4.5, 5.2, 15.0], [0, 2.8, -8.5], f, 1165, 0.0022, 39, -0.04) },
    { f: 1290, dur: 26, s: (f) => pushCam([-4.5, 4.8, 13.5], [0, 2.5, -8.0], f, 1290, 0.0024, 38) },
  ],
  8: [
    { f: 1435, cut: true, s: (f) => pushCam([0, 5.4, 15.5], [0, 2.2, -2.0], f, 1435, 0.0018, 40) },
    { f: 1620, dur: 30, s: (f) => pushCam([2.6, 3.3, 10.5], [1.9, 1.8, 0.4], f, 1620, 0.0022, 37) },
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
  if (id === 2) return { cInf: 0 };
  if (id === 1 || id === 6 || id === 8) return { cInf: 12 };
  return { cInf: 9 };
};
