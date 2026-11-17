// 8-shot, 2356-frame (78.53 s @ 30 fps) timeline synced precisely to voice/ratelimit_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2356;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 240, light: "day" },
  { id: 2, a: 240, b: 480, light: "day" },
  { id: 3, a: 480, b: 730, light: "day" },
  { id: 4, a: 730, b: 1160, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 5, a: 1160, b: 1400, light: "golden", sunAz: -18, sunEl: 12 },
  { id: 6, a: 1400, b: 1810, light: "day" },
  { id: 7, a: 1810, b: 2030, light: "day" },
  { id: 8, a: 2030, b: TOTAL, light: "golden", sunAz: -26, sunEl: 11 },
];

export const XFADE: Record<number, number> = { 4: 8, 6: 8, 8: 8 };
export const FLASH_AT = 240;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type RateSim = {
  hookFire: number;     // f85+ machine-gun swarm hits tiny padlock
  lockBreak: number;    // f195+ padlock snaps open & door swings
  botBarrage: number;   // f855+ bot thousands/sec barrage beats slow human
  botHit: number;       // f1025+ account breached in Shot 4
  shieldDrop: number;   // f1430+ heavy RATE LIMIT + LOCKOUT shield clamps on
  block429: number;     // f1550+ swarm bounces off with 429 TOO MANY REQUESTS
  otpExpire: number;    // f1835+ 5 failed tries -> OTP EXPIRED
};

export const simAt = (f: number): RateSim => ({
  hookFire: smooth((f - 85) / 20),
  lockBreak: smooth((f - 195) / 22),
  botBarrage: smooth((f - 855) / 22),
  botHit: smooth((f - 1025) / 25),
  shieldDrop: smooth((f - 1425) / 30),
  block429: smooth((f - 1540) / 30),
  otpExpire: smooth((f - 1835) / 35),
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
  { f: 205, amp: 0.028 },   // padlock snaps open
  { f: 1030, amp: 0.024 },  // bot hits winning OTP
  { f: 1450, amp: 0.028 },  // RATE LIMIT shield slam
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
    { f: 0, s: (f) => pushCam([0, 3.6, 15.2], [0, 2.0, -3.5], f, 0, 0.0022, 40) },
    { f: 95, dur: 24, s: (f) => pushCam([0.6, 3.3, 13.5], [0, 2.0, -4.2], f, 95, 0.0025, 39, 0.03) },
  ],
  2: [
    { f: 240, cut: true, s: (f) => pushCam([0, 6.8, 20.5], [0, 2.2, -5.0], f, 240, 0.0018, 42) },
  ],
  3: [
    { f: 480, cut: true, s: (f) => pushCam([-1.4, 3.8, 15.2], [0, 2.3, -4.5], f, 480, 0.002, 40) },
  ],
  4: [
    { f: 730, cut: true, s: (f) => pushCam([-1.0, 3.8, 16.5], [-0.2, 2.1, -2.5], f, 730, 0.0018, 40) },
    { f: 855, dur: 26, s: (f) => pushCam([0.8, 3.8, 16.5], [0.2, 2.1, -3.5], f, 855, 0.0022, 40, -0.03) },
  ],
  5: [
    { f: 1160, cut: true, s: (f) => pushCam([0.4, 3.6, 14.5], [0, 2.1, -4.0], f, 1160, 0.002, 39) },
  ],
  6: [
    { f: 1400, cut: true, s: (f) => pushCam([0, 4.8, 17.0], [0, 2.2, -3.5], f, 1400, 0.002, 40) },
    { f: 1550, dur: 26, s: (f) => pushCam([1.8, 4.2, 16.0], [0.2, 2.1, -3.0], f, 1550, 0.0018, 40) },
  ],
  7: [
    { f: 1810, cut: true, s: (f) => pushCam([-0.8, 4.2, 16.2], [0, 2.3, -4.0], f, 1810, 0.0018, 40) },
  ],
  8: [
    { f: 2030, cut: true, s: (f) => pushCam([0, 5.2, 18.2], [0, 2.3, -3.5], f, 2030, 0.0016, 41) },
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
  return { cInf: 2.5 };
};
