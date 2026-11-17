// Flat 2D bean-head cartoon cast + symbolic protest placards + 2D effects on Canvas2D.
export const INK = "#241726";
export const SKIN = "#ffe2c2";
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
type C3 = [number, number, number];
const SH_SKIN: C3 = [0.96, 0.86, 0.84];
const SH_CLOTH: C3 = [0.64, 0.66, 0.74];
const SH_FELT: C3 = [0.62, 0.62, 0.7];

export type Build = "adult" | "stout" | "elder";
export type Outfit = {
  jacket: string; pants: string; boots: string;
  hat?: "cleanroom" | "hardhat" | "curly" | "cap" | "hair" | null;
  hatCol?: string; skin?: string; hair?: string; wrap?: string;
  badge?: string; build?: Build;
};
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

// Cast outfits tailored for the Pax Silica Philippines + Aeta community story
export const WORKER = (v = 0): Outfit => ({
  jacket: ["#4576b5", "#5a8652", "#c87a3b"][v % 3], pants: "#3b4252", boots: "#3a2e28",
  hat: "cap", hatCol: "#2d5d8c", skin: ["#e5b68a", "#d69f72", "#c88d61"][v % 3],
});
export const ENGINEER = (v = 0): Outfit => ({
  jacket: "#eef4f8", pants: "#dce7ef", boots: "#c8d6e2",
  hat: "cleanroom", hatCol: "#e3eef6", badge: "#2bb673",
  skin: ["#efd0b2", "#dfb289", "#c88f64"][v % 3],
});
export const AETA = (v = 0): Outfit => ({
  jacket: ["#c86a3a", "#4e8b57", "#d49b3c", "#a34f44"][v % 4], pants: "#4d3c32", boots: "#5a3d28",
  hat: "curly", hair: "#221a1d", wrap: v % 2 ? "#8c3f34" : undefined,
  skin: ["#996241", "#875335", "#a9714d"][v % 3],
});
export const AETA_ELDER: Outfit = {
  jacket: "#e6dbc8", pants: "#574336", boots: "#5a3d28",
  hat: "curly", hair: "#7c777e", wrap: "#9e4838",
  skin: "#8c5738", build: "elder",
};
export const OFFICIAL: Outfit = {
  jacket: "#f5efe0", pants: "#2e3545", boots: "#231e24",
  hat: "hair", hair: "#27232c", badge: "#0038a8",
  skin: "#dfb289", build: "stout",
};

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g; g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

export type Expr = "neutral" | "stern" | "smile" | "nervous" | "shock" | "relief";
type EyeK = "dot" | "lid" | "happy" | "dash" | "shock";
type MouthK = "dash" | "frown" | "smile" | "wave" | "O";
const FACE: Record<Expr, { eye: EyeK; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: "lid", brow: [0, -1], mouth: "dash" },
  stern: { eye: "lid", brow: [3, -2], mouth: "frown" },
  smile: { eye: "dot", brow: [-1, -2], mouth: "smile" },
  nervous: { eye: "dot", brow: [-3, 2], mouth: "wave" },
  shock: { eye: "shock", brow: [-7, -6], mouth: "O" },
  relief: { eye: "happy", brow: [-2, 1], mouth: "smile" },
};

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, blink: boolean) => {
  const k: EyeK = blink && kind !== "happy" ? "dash" : kind;
  const lx = x + look * 3 * u, lw = 3.8 * u;
  if (k === "dot") p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0);
  else if (k === "lid") { p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); }
  else if (k === "happy") p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw);
  else if (k === "dash") p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw);
  else { p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u); }
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number) => {
  const mw = 4 * u;
  if (kind === "dash") p.stroke([[mx - 5.5 * u, my], [mx + 5.5 * u, my - 0.8 * u]], mw);
  else if (kind === "frown") p.arc(mx, my + 3 * u, 6.5 * u, 3.5 * u, 200, 340, mw);
  else if (kind === "smile") p.arc(mx, my - 3 * u, 8 * u, 4.5 * u, 20, 160, mw);
  else if (kind === "O") p.ell(mx, my + 2 * u, 8 * u, 10 * u, MOUTH, 3 * u);
  else { const s: P2[] = []; for (let i = 0; i <= 10; i++) s.push([mx - 8 * u + i * 1.6 * u, my + 1.5 * u * Math.sin(i * 1.4)]); p.stroke(s, 3 * u); }
};

const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  if (o.hat === "curly") {
    const col = o.hair ?? "#221a1d";
    for (let i = -4; i <= 4; i++) {
      const a = -Math.PI / 2 + i * 0.28, rx = cx + Math.cos(a) * H.a * 0.96, ry = hc + Math.sin(a) * H.b * 0.96;
      p.ell(rx, ry, 24 * u, 22 * u, col, ow * 0.75);
    }
    return;
  }
  if (!o.hat) return;
  const cut = crown + (o.hat === "cap" || o.hat === "cleanroom" ? 0.32 : 0.42) * HH;
  const keep = (_x: number, y: number) => y < cut;
  const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
  const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
    .map(([x, y]) => [cx + (x - cx) * 1.04, hc + (y - hc) * 1.04] as P2);
  if (arc.length < 3) return;
  const col = o.hat === "hair" ? (o.hair ?? "#27232c") : (o.hatCol ?? "#e3eef6");
  p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
  p.poly(arc, null, ow);
  if (o.hat === "cap") {
    const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1);
    p.ell(cx + s * 4 * u, cut + 1.5 * u, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, 0);
  }
};

export type Prop = null | "wafer" | "box" | "hoe" | "clipboard" | "signWater" | "signLand";
export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: "stroll" | "stand"; look?: number; blink?: boolean;
  prop?: Prop; tilt?: number; wave?: number; light?: number; facing?: -1 | 0 | 1; seed?: number;
};

const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  elder: { a: 115, torso: 1.04, legs: 1.35, tw: 0.78 },
};

export const bodyFront = (p: Pen, o: Outfit, opts: FrontOpts) => {
  const { phase = 0, expr = "neutral", mode = "stand", look = 0, blink = false, prop = null, tilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2;
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  const bob = mode === "stroll" ? 0.015 * tall * Math.cos(2 * two * phase) : 0;
  const torsoBot = sole - Bd.legs * HH + bob;
  const chin = torsoBot - Bd.torso * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;

  p.rot = null;
  const L = mode === "stroll" ? 33 : 0;
  for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
    const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
    const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
    const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
    p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], footW + 3, INK);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], footW, footCol);
  }

  const sway = mode === "stroll" ? 1.0 * Math.sin(two * phase) : 0;
  const A = tilt + sway;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const T: Blob = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const hang = (side: number, fwd: number): [P2, P2, P2] => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u]];
  };
  const sw = mode === "stroll" ? Math.sin(two * phase) : 0;
  type Arm = { pts: [P2, P2, P2]; front: boolean };
  const arms: Arm[] = [{ pts: hang(-1, -sw), front: false }];
  if (wave !== undefined) {
    const S = sh(1);
    arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.65 * HH]], front: true });
  } else if (prop) {
    const S = sh(1);
    arms.push({ pts: [S, [tcx + 1.1 * T.a + 8 * u, S[1] + 0.38 * HH], [tcx + 1.25 * T.a + 12 * u, S[1] + 0.12 * HH]], front: true });
  } else {
    arms.push({ pts: hang(1, sw), front: false });
  }

  const drawArm = (a: Arm) => { p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol); p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u); };
  for (const a of arms) if (!a.front) drawArm(a);

  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.wrap) p.band([[tcx - 0.8 * T.a, chin - 0.05 * HH], [tcx + 0.85 * T.a, torsoBot - 0.12 * HH]], o.wrap, 9 * u, 1.8 * u);
    if (o.badge) p.poly([[tcx + 8 * u, chin + 0.2 * HH], [tcx + 22 * u, chin + 0.2 * HH], [tcx + 22 * u, chin + 0.34 * HH], [tcx + 8 * u, chin + 0.34 * HH]], o.badge, 1.5 * u);
  });
  p.inkRing(tp, ow, thick);

  for (const a of arms) if (a.front) {
    drawArm(a);
    const [hx, hy] = a.pts[2];
    if (prop === "wafer") {
      p.ell(hx + 6 * u, hy - 14 * u, 18 * u, 18 * u, "#4fc3f7", 2.2 * u);
      p.stroke([[hx - 4 * u, hy - 14 * u], [hx + 16 * u, hy - 14 * u]], 1.8 * u, "#165278");
      p.stroke([[hx + 6 * u, hy - 24 * u], [hx + 6 * u, hy - 4 * u]], 1.8 * u, "#165278");
    } else if (prop === "box") {
      p.poly([[hx - 18 * u, hy - 18 * u], [hx + 18 * u, hy - 18 * u], [hx + 18 * u, hy + 10 * u], [hx - 18 * u, hy + 10 * u]], "#d5a36c", 2.2 * u);
    } else if (prop === "hoe") {
      p.band([[hx - 10 * u, hy + 55 * u], [hx + 10 * u, hy - 55 * u]], "#8a5a34", 4.5 * u, 1.4 * u, "round");
      p.poly([[hx + 2 * u, hy - 58 * u], [hx + 24 * u, hy - 50 * u], [hx + 20 * u, hy - 40 * u], [hx - 2 * u, hy - 48 * u]], "#7d848c", 2 * u);
    } else if (prop === "clipboard") {
      p.poly([[hx - 12 * u, hy - 20 * u], [hx + 14 * u, hy - 20 * u], [hx + 14 * u, hy + 14 * u], [hx - 12 * u, hy + 14 * u]], "#f5f1e4", 2 * u);
      p.stroke([[hx - 6 * u, hy - 8 * u], [hx + 8 * u, hy - 8 * u]], 2 * u, "#2b6cb0");
      p.stroke([[hx - 6 * u, hy + 2 * u], [hx + 6 * u, hy + 2 * u]], 2 * u, "#2b6cb0");
    } else if (prop === "signWater" || prop === "signLand") {
      p.band([[hx, hy + 45 * u], [hx, hy - 35 * u]], "#8a5a34", 4.5 * u, 1.4 * u, "round");
      p.poly([[hx - 34 * u, hy - 90 * u], [hx + 34 * u, hy - 90 * u], [hx + 34 * u, hy - 32 * u], [hx - 34 * u, hy - 32 * u]], "#fff5dc", 2.6 * u);
      if (prop === "signWater") {
        p.poly([[hx, hy - 78 * u], [hx + 14 * u, hy - 54 * u], [hx, hy - 42 * u], [hx - 14 * u, hy - 54 * u]], "#2d89c8", 2 * u);
        p.stroke([[hx - 20 * u, hy - 42 * u], [hx + 20 * u, hy - 80 * u]], 4 * u, "#ce2d2d");
      } else {
        p.poly([[hx - 16 * u, hy - 44 * u], [hx, hy - 76 * u], [hx + 16 * u, hy - 44 * u]], "#4e8b57", 2 * u);
        p.stroke([[hx - 20 * u, hy - 42 * u], [hx + 20 * u, hy - 80 * u]], 4 * u, "#ce2d2d");
      }
    }
  }

  const [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = A ? [rad(A), 300, chin, cpx - 300, cpy - chin] : null;
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, 300, hc, light, seed, facing);

  const F = FACE[expr], fx = 300 + 7 * u * facing, ex = 13 * u, ey = hc;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    eye(p, F.eye, x, ey, u, side, look, blink);
    const [dI, dO] = F.brow, by = ey - 19 * u;
    if (F.eye === "shock") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
  }
  mouth(p, F.mouth, 300 + 8 * u * facing, hc + 20 * u, u);
  if (expr === "nervous") p.ell(300 + 40 * u * (facing || 1), hc - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
  p.rot = null;
};

// ---------------- 2D FX cards ----------------
export const fxBlob = (p: Pen, w: number, h: number, a = 0.25) => {
  const g = p.g, gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45);
  gr.addColorStop(0, `rgba(20,16,32,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
};

export const fxAlert = (p: Pen, kind: "warn" | "quest" | "check") => {
  if (kind === "warn") {
    p.poly([[64, 14], [116, 108], [12, 108]], "#ffd34e", 6);
    p.stroke([[64, 40], [64, 76]], 10, INK);
    p.dot(64, 94, 6, INK);
  } else if (kind === "quest") {
    p.ell(64, 64, 48, 48, "#fff5dc", 6);
    p.arc(64, 48, 16, 16, 180, 380, 9, INK);
    p.stroke([[64, 64], [64, 78]], 9, INK);
    p.dot(64, 94, 5.5, INK);
  } else {
    p.ell(64, 64, 48, 48, "#47c47a", 6);
    p.stroke([[38, 66], [56, 84], [92, 44]], 10, WHITE);
  }
};
