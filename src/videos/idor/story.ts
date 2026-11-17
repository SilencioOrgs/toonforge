// 8-shot, 2068-frame (68.93 s @ 30 fps) timeline synced precisely to voice/idor_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2068;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 215, light: "day" },
  { id: 2, a: 215, b: 350, light: "day" },
  { id: 3, a: 350, b: 645, light: "day" },
  { id: 4, a: 645, b: 995, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 5, a: 995, b: 1165, light: "golden", sunAz: -18, sunEl: 12 },
  { id: 6, a: 1165, b: 1595, light: "day" },
  { id: 7, a: 1595, b: 1855, light: "day" },
  { id: 8, a: 1855, b: TOTAL, light: "golden", sunAz: -28, sunEl: 11 },
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 6: 8, 8: 8 };
export const FLASH_AT = 215;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type IdorSim = {
  hookOpen: number;     // f88+ all lockers swing open
  aOpen104: number;     // f490+ User A legitimately opens #104
  bEditUrl: number;     // f700+ User B edits 104 -> 105
  bOpen105: number;     // f840+ User B opens #105 illegally
  hotelOpen: number;    // f1060+ all 3 hotel doors swing open
  ownerLock: number;    // f1185+ AND user_id = ? shield clamps onto server gate
  block403: number;     // f1460+ server rejects #105 with 403
  uuidFlip: number;     // f1660+ 104/105/106 flip to random UUIDs
};

export const simAt = (f: number): IdorSim => ({
  hookOpen: smooth((f - 85) / 28),
  aOpen104: smooth((f - 500) / 35) * (1 - smooth((f - 640) / 20)),
  bEditUrl: smooth((f - 690) / 35),
  bOpen105: smooth((f - 835) / 35) * (1 - smooth((f - 990) / 20)),
  hotelOpen: smooth((f - 1045) / 30),
  ownerLock: smooth((f - 1185) / 40),
  block403: smooth((f - 1440) / 35),
  uuidFlip: smooth((f - 1650) / 45),
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
  { f: 88, amp: 0.025 },
  { f: 838, amp: 0.024 },
  { f: 1190, amp: 0.026 },
  { f: 1470, amp: 0.024 },
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
    { f: 0, s: (f) => pushCam([0, 3.6, 15.8], [0, 2.0, -2.5], f, 0, 0.0018, 40) },
    { f: 145, dur: 28, s: (f) => pushCam([-0.4, 3.4, 14.2], [0, 1.9, -2.0], f, 145, 0.0022, 39, -0.04) },
  ],
  2: [
    { f: 215, cut: true, s: (f) => pushCam([0, 7.2, 20.5], [0, 2.2, -5.5], f, 215, 0.002, 42) },
  ],
  3: [
    { f: 350, cut: true, s: (f) => pushCam([-3.2, 3.8, 14.2], [-1.2, 2.0, -2.5], f, 350, 0.0022, 39) },
    { f: 495, dur: 28, s: (f) => pushCam([-2.6, 4.0, 13.8], [-1.2, 2.1, -3.5], f, 495, 0.0022, 39) },
  ],
  4: [
    { f: 645, cut: true, s: (f) => pushCam([3.4, 3.8, 14.2], [1.1, 2.0, -2.0], f, 645, 0.0022, 39, 0.04) },
    { f: 820, dur: 26, s: (f) => pushCam([2.6, 4.2, 14.5], [0.5, 2.1, -3.5], f, 820, 0.0022, 39, -0.03) },
  ],
  5: [
    { f: 995, cut: true, s: (f) => pushCam([28.5, 4.6, 15.0], [28.0, 2.1, -3.5], f, 995, 0.002, 40) },
  ],
  6: [
    { f: 1165, cut: true, s: (f) => pushCam([0, 5.0, 17.5], [0, 2.3, -3.5], f, 1165, 0.002, 40) },
    { f: 1360, dur: 28, s: (f) => pushCam([2.8, 4.2, 15.2], [0.4, 2.1, -3.0], f, 1360, 0.0022, 39) },
  ],
  7: [
    { f: 1595, cut: true, s: (f) => pushCam([0, 5.2, 18.8], [0, 2.4, -4.5], f, 1595, 0.002, 41) },
  ],
  8: [
    { f: 1855, cut: true, s: (f) => pushCam([0, 5.2, 18.5], [0, 2.3, -3.5], f, 1855, 0.0018, 41) },
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
  if (id === 2 || id === 5 || id === 8) return { cInf: 0 };
  return { cInf: 2.5 };
};
