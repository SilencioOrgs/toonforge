// 9-shot, 2497-frame (83.23 s @ 30 fps) timeline synced precisely to voice/redis_voice.wav.
import { Light, smooth, smoother, V3 } from "../paxsilica/story";

export const FPS = 30;
export const TOTAL = 2497;

export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 266, light: "day" },
  { id: 2, a: 266, b: 410, light: "day" },
  { id: 3, a: 410, b: 878, light: "day" },
  { id: 4, a: 878, b: 1024, light: "day" },
  { id: 5, a: 1024, b: 1367, light: "golden", sunAz: -24, sunEl: 11 },
  { id: 6, a: 1367, b: 1532, light: "golden", sunAz: -20, sunEl: 12 },
  { id: 7, a: 1532, b: 1784, light: "day" },
  { id: 8, a: 1784, b: 2061, light: "day" },
  { id: 9, a: 2061, b: TOTAL, light: "golden", sunAz: -22, sunEl: 12 },
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 7: 8, 8: 8, 9: 8 };
export const FLASH_ATS = [206, 1298, 1367];

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

export type RedisSim = {
  s1Surge: number;     // Shot 1 viral traffic wave (0..146)
  s1Crash: number;     // Shot 1 DB crash (206+)
  s3Go: number;        // Shot 3 single request climbs to DB (587..735)
  s3Sort: number;      // Shot 3 DB sorting/searching records (720..790)
  s3Back: number;      // Shot 3 response returns to App Server (785..875)
  s5Flood: number;     // Shot 5 10,000 concurrent requests hammer DB (1040..1295)
  s5Crash: number;     // Shot 5 CPU 100% & system collapse (1298+)
  redisDrop: number;   // Shot 6 Redis vault drops onto center pedestal (1405..1435)
  missGo: number;      // Shot 7 Request #1 misses Redis & reaches DB (1545..1618)
  missSave: number;    // Shot 7 Answer returns & populates Redis RAM (1625..1700)
  hitStream: number;   // Shot 8 9,999 requests hit Redis in 2ms (1790..2055)
  ttlCycle: number;    // Shot 9 TTL countdown & clean auto-refresh (2075..2265)
};

export const simAt = (f: number): RedisSim => ({
  s1Surge: smooth((f - 20) / 135),
  s1Crash: smooth((f - 206) / 16),
  s3Go: smooth((f - 585) / 135),
  s3Sort: smooth((f - 710) / 70),
  s3Back: smooth((f - 780) / 90),
  s5Flood: smooth((f - 1035) / 245),
  s5Crash: smooth((f - 1298) / 18),
  redisDrop: smooth((f - 1405) / 30),
  missGo: smooth((f - 1542) / 70),
  missSave: smooth((f - 1625) / 68),
  hitStream: smooth((f - 1790) / 260),
  ttlCycle: smooth((f - 2075) / 180),
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
  { f: 206, amp: 0.036 },   // Shot 1 DB crash
  { f: 1298, amp: 0.040 },  // Shot 5 full system crash
  { f: 1435, amp: 0.026 },  // Shot 6 Redis vault lands!
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
  1: [{ f: 0, s: (f) => pushCam([0, 4.7, 22.0], [0, 2.3, -3.5], f, 0, 0.0014, 41) }],
  2: [{ f: 266, cut: true, s: (f) => pushCam([0, 6.2, 23.2], [0, 2.4, -3.5], f, 266, 0.0012, 42) }],
  3: [
    { f: 410, cut: true, s: (f) => pushCam([-0.4, 4.7, 21.4], [0, 2.3, -3.5], f, 410, 0.0010, 40) },
    { f: 620, dur: 90, s: (f) => pushCam([1.6, 5.0, 20.6], [1.4, 2.5, -3.5], f, 620, 0.0009, 40) },
  ],
  4: [{ f: 878, cut: true, s: (f) => pushCam([-1.4, 4.2, 18.5], [-1.0, 2.1, -2.5], f, 878, 0.0014, 39) }],
  5: [{ f: 1024, cut: true, s: (f) => pushCam([0.8, 4.8, 21.6], [0.8, 2.4, -3.5], f, 1024, 0.0014, 41) }],
  6: [{ f: 1367, cut: true, s: (f) => pushCam([0, 4.4, 19.6], [0, 2.2, -3.5], f, 1367, 0.0015, 40) }],
  7: [{ f: 1532, cut: true, s: (f) => pushCam([0.6, 4.7, 20.6], [0.5, 2.3, -3.5], f, 1532, 0.0012, 40) }],
  8: [{ f: 1784, cut: true, s: (f) => pushCam([-0.6, 4.6, 20.4], [-0.4, 2.3, -3.5], f, 1784, 0.0014, 40) }],
  9: [{ f: 2061, cut: true, s: (f) => pushCam([0, 5.2, 23.0], [0, 2.4, -3.5], f, 2061, 0.0012, 41) }],
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
