// Timeline, camera grammar, DOF focus, and animated simulation state for the voiceless Pax Silica + Aeta short.
export const FPS = 30;
export const TOTAL = 1800; // 60.0 s exactly
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const smoother = (x: number) => { const u = clamp01(x); return u * u * u * (u * (u * 6 - 15) + 10); };

export type Light = "day" | "golden";
export type ShotDef = {
  id: number; a: number; b: number; light: Light;
  badge: string; title: string; accent: string;
  sunAz?: number; sunEl?: number;
};

export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 150, light: "day", badge: "TARLAC · TODAY", title: "New Clark City & Aeta Foothills", accent: "#43a047" },
  { id: 2, a: 150, b: 330, light: "day", badge: "CURRENT STATUS", title: "Basic Chip Assembly & Ancestral Farms", accent: "#2d89c8" },
  { id: 3, a: 330, b: 480, light: "day", badge: "IF PAX SILICA IS APPROVED", title: "4,000-Acre Security Zone Activated", accent: "#2bb673" },
  { id: 4, a: 480, b: 690, light: "day", badge: "LUZON CORRIDOR", title: "Subic ↔ Clark ↔ Batangas Link", accent: "#2bb673" },
  { id: 5, a: 690, b: 900, light: "day", badge: "PROJECTED UPSIDE", title: "$40B–$70B+ · 100K–200K Tech Jobs", accent: "#23a393" },
  { id: 6, a: 900, b: 1140, light: "golden", badge: "AETA COMMUNITIES · CAPAS", title: "Ancestral Land & Consultation Fears", accent: "#e88835", sunAz: -24, sunEl: 11 },
  { id: 7, a: 1140, b: 1320, light: "golden", badge: "RESOURCE PRESSURE", title: "Water, Power & Land Protests", accent: "#d9534f", sunAz: -18, sunEl: 9 },
  { id: 8, a: 1320, b: 1530, light: "day", badge: "OFFICIAL SAFEGUARDS", title: "PH Law Only · Buildable Zone · NCIP", accent: "#2b6cb0" },
  { id: 9, a: 1530, b: 1680, light: "day", badge: "CLEAN-TECH & BUFFER", title: "Homes Spared · Protected Local Water", accent: "#2bb673" },
  { id: 10, a: 1680, b: 1800, light: "golden", badge: "IF APPROVED: THE BALANCE", title: "Silicon Growth vs. Community Trust", accent: "#e8a838", sunAz: -35, sunEl: 12 },
];

export const XFADE: Record<number, number> = { 6: 8, 8: 8, 10: 8 };
export const FLASH_AT = 330;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- simulation state per frame ----------------
export type SimState = {
  approved: number;    // 0 -> 1 after f330
  fabs: number;        // 0 -> 1 cleanrooms rise (f440..600)
  meters: number;      // 0 -> 1 job & investment bars climb (f670..860)
  fencePush: number;   // 0 -> 1 fence shifts toward village (f900..1180) then pulls back to buffer (f1320..1420)
  waterLvl: number;    // 1.0 -> 0.34 during pressure (f960..1260) -> 0.92 with clean-tech loop (f1440..1620)
  protest: number;     // 0 -> 1 in shots 6-7
  safeguard: number;   // 0 -> 1 in shots 8-10 (PH law shield + green buffer wall + NCIP meet)
  cleanLoop: number;   // 0 -> 1 water recycling pipes glow in shots 9-10
  scaleTilt: number;   // gentle balance tilt in shot 10
};

export const simAt = (f: number): SimState => {
  const approved = smooth((f - 330) / 45);
  const fabs = smooth((f - 430) / 140);
  const meters = smooth((f - 660) / 180);
  const pushIn = smooth((f - 900) / 180);
  const pullBack = smooth((f - 1320) / 70);
  const fencePush = pushIn * (1 - pullBack);
  const dip = smooth((f - 960) / 210);
  const recover = smooth((f - 1440) / 160);
  const waterLvl = 1.0 - 0.66 * dip * (1 - 0.88 * recover);
  const protest = smooth((f - 1020) / 70) * (1 - smooth((f - 1310) / 30));
  const safeguard = smooth((f - 1320) / 60);
  const cleanLoop = smooth((f - 1520) / 80);
  const scaleTilt = 0.14 * Math.sin((f - 1680) * 0.055) * (1 - smooth((f - 1750) / 40));
  return { approved, fabs, meters, fencePush, waterLvl, protest, safeguard, cleanLoop, scaleTilt };
};

// ---------------- camera keys ----------------
type CamS = { pos: V3; look: V3; fov: number; roll: number };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => CamS };
const L = (a: number, b: number, t: number) => a + (b - a) * t;
const creep = (f: number, f0: number, rate = 0.0022) => (f - f0) * rate;
const cam = (pos: V3, look: V3, fov = 40, roll = 0): CamS => ({ pos, look, fov, roll });
const pushCam = (p: V3, l: V3, f: number, f0: number, rate = 0.0024, fov = 40, roll = 0): CamS => {
  const k = creep(f, f0, rate);
  return cam([L(p[0], l[0], k), L(p[1], l[1], k), L(p[2], l[2], k)], l, fov, roll);
};

const KICKS: { f: number; amp: number }[] = [
  { f: 330, amp: 0.028 },
  { f: 930, amp: 0.018 },
  { f: 1335, amp: 0.02 },
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
    { f: 0, s: (f) => pushCam([-8, 22, 62], [6, 3.5, 4], f, 0, 0.0018, 42) },
    { f: 110, dur: 40, s: (f) => pushCam([-4, 15, 44], [5, 3, 2], f, 110, 0.002, 40) },
  ],
  2: [
    { f: 150, cut: true, s: (f) => pushCam([1.5, 4.8, 6.0], [-9.5, 1.6, 15.0], f, 150, 0.0024, 40) },
    { f: 245, dur: 32, s: (f) => pushCam([10, 4.2, 16], [19, 1.8, 0], f, 245, 0.0024, 38) },
  ],
  3: [
    { f: 330, cut: true, s: (f) => pushCam([-12, 24, 54], [-6, 1.5, 4], f, 330, 0.002, 42, -0.05) },
    { f: 420, dur: 28, s: (f) => pushCam([-8, 16, 36], [-8, 2.5, 0], f, 420, 0.0025, 40) },
  ],
  4: [
    { f: 480, cut: true, s: (f) => pushCam([2, 8.5, 24], [-11, 3.5, -4], f, 480, 0.0022, 40) },
    { f: 610, dur: 28, s: (f) => pushCam([-1, 4.2, 15], [-10, 2.0, 2], f, 610, 0.0024, 38) },
  ],
  5: [
    { f: 690, cut: true, s: (f) => pushCam([8.5, 9.5, 27], [-5.5, 5.5, -3.5], f, 690, 0.0024, 40, 0.04) },
    { f: 810, dur: 30, s: (f) => pushCam([6.5, 12.0, 30], [-5.5, 5.8, -3.5], f, 810, 0.0022, 40) },
  ],
  6: [
    { f: 900, cut: true, s: (f) => pushCam([9.5, 4.0, 17], [17, 1.8, 0], f, 900, 0.0022, 38, -0.04) },
    { f: 1030, dur: 30, s: (f) => pushCam([10.5, 3.0, 11.5], [16.5, 1.7, 0.2], f, 1030, 0.0025, 36) },
  ],
  7: [
    { f: 1140, cut: true, s: (f) => pushCam([8.5, 3.2, 12.5], [16.5, 2.0, -2.0], f, 1140, 0.0025, 38, 0.06) },
    { f: 1245, dur: 24, s: (f) => pushCam([9.5, 2.8, 9.5], [16.5, 2.0, -2.5], f, 1245, 0.0025, 36) },
  ],
  8: [
    { f: 1320, cut: true, s: (f) => pushCam([11.5, 4.5, 19], [9.0, 2.0, -0.5], f, 1320, 0.0022, 40) },
    { f: 1435, dur: 26, s: (f) => pushCam([12.0, 3.6, 15.5], [9.5, 1.9, -0.2], f, 1435, 0.0024, 39) },
  ],
  9: [
    { f: 1530, cut: true, s: (f) => pushCam([4.5, 11.5, 31], [4.5, 2.5, -2.5], f, 1530, 0.0022, 44) },
    { f: 1615, dur: 24, s: (f) => pushCam([5.5, 10.0, 27], [5.5, 2.5, -3.0], f, 1615, 0.0024, 42) },
  ],
  10: [
    { f: 1680, cut: true, s: (f) => pushCam([7, 21, 56], [6.5, 4.0, -1], f, 1680, 0.0018, 44) },
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
  if (id === 1 || id === 3 || id === 10) return { cInf: 0 };
  if (id === 2 || id === 4 || id === 5 || id === 8 || id === 9) return { cInf: 9 };
  return { cInf: 12 };
};
