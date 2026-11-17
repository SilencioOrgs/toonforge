// 8-shot, 2219-frame (73.97 s @ 30 fps) timeline synced precisely to voice/sqli_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2219;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 270, light: "day" },
  { id: 2, a: 270, b: 430, light: "day" },
  { id: 3, a: 430, b: 710, light: "day" },
  { id: 4, a: 710, b: 1070, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 5, a: 1070, b: 1295, light: "golden", sunAz: -18, sunEl: 12 },
  { id: 6, a: 1295, b: 1710, light: "day" },
  { id: 7, a: 1710, b: 1960, light: "day" },
  { id: 8, a: 1960, b: TOTAL, light: "golden", sunAz: -26, sunEl: 11 },
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 6: 8, 8: 8 };
export const FLASH_AT = 270;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type SqliSim = {
  injectSlide: number;  // f85+ red ' OR 1=1 command packet flies into query gate
  vaultOpen: number;    // f160+ Admin Vault swings open!
  concatWeld: number;   // f470+ string + user input merge dangerously in Shot 3
  truePass: number;     // f860+ OR 1=1 turns TRUE and passes straight into Admin in Shot 4
  guardOpen: number;    // f1120+ guard booth gate opens for secret paper slip in Shot 5
  prepShield: number;   // f1365+ PREPARED STATEMENT shield drops cleanly onto gate
  dataTrap: number;     // f1750+ malicious input trapped inside DATA ONLY (?) box & bounced
};

export const simAt = (f: number): SqliSim => ({
  injectSlide: smooth((f - 85) / 35),
  vaultOpen: smooth((f - 160) / 30),
  concatWeld: smooth((f - 470) / 40),
  truePass: smooth((f - 855) / 45),
  guardOpen: smooth((f - 1120) / 35),
  prepShield: smooth((f - 1365) / 35),
  dataTrap: smooth((f - 1750) / 35),
});

type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.002, fov = 40, roll = 0): CamS => {
  const k = (f - f0) * rate;
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 170, amp: 0.026 },
  { f: 960, amp: 0.024 },
  { f: 1385, amp: 0.028 },
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
    { f: 0, s: (f) => pushCam([0, 3.6, 15.6], [0, 2.0, -3.5], f, 0, 0.002, 40) },
    { f: 155, dur: 24, s: (f) => pushCam([-0.4, 3.4, 14.2], [0, 2.0, -4.0], f, 155, 0.0022, 39, -0.03) },
  ],
  2: [
    { f: 270, cut: true, s: (f) => pushCam([0, 6.8, 20.5], [0, 2.2, -5.0], f, 270, 0.0018, 42) },
  ],
  3: [
    { f: 430, cut: true, s: (f) => pushCam([-1.0, 3.8, 15.6], [0, 2.2, -4.0], f, 430, 0.002, 40) },
  ],
  4: [
    { f: 710, cut: true, s: (f) => pushCam([0.8, 3.8, 16.0], [0, 2.1, -3.5], f, 710, 0.0018, 40) },
    { f: 880, dur: 26, s: (f) => pushCam([-0.8, 4.0, 15.4], [0, 2.1, -4.5], f, 880, 0.002, 40, 0.03) },
  ],
  5: [
    { f: 1070, cut: true, s: (f) => pushCam([28.4, 4.4, 15.8], [28.0, 2.1, -3.5], f, 1070, 0.0018, 40) },
  ],
  6: [
    { f: 1295, cut: true, s: (f) => pushCam([0, 4.8, 17.2], [0, 2.2, -3.5], f, 1295, 0.0018, 40) },
  ],
  7: [
    { f: 1710, cut: true, s: (f) => pushCam([0.8, 4.2, 16.5], [0, 2.2, -3.5], f, 1710, 0.0018, 40) },
  ],
  8: [
    { f: 1960, cut: true, s: (f) => pushCam([0, 5.2, 18.4], [0, 2.3, -3.5], f, 1960, 0.0016, 41) },
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
