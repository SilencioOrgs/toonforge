// Stickman/bean-head cast using smartphone/device & hotel keycard mimicking every beat of the IDOR script.
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { Actor, Fx, Pool } from "../paxsilica/cast";
import { blobPts, Expr, fxAlert, fxBlob, headBlob, INK, mix, mul, Outfit, Pen, shade, thickAngle } from "../paxsilica/toon";
import { V3 } from "../paxsilica/story";
import { FPS, IdorSim } from "./story";

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const USER_A: Outfit = { jacket: "#2d89c8", pants: "#2e3545", boots: "#231e24", hat: "cap", hatCol: "#1c5a8a", skin: "#e8be96" };
const USER_B: Outfit = { jacket: "#e07a34", pants: "#3b3f52", boots: "#2d2420", hat: "hair", hair: "#2b2024", skin: "#d9a579" };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : [480, 800, 0.8];

const blinkAt = (seed: number, f: number) => ((f + seed * 17) % 59) < 4;

// Custom stickman drawer holding and tapping a glowing device (phone) or keycard!
function drawDeviceStickman(
  p: Pen,
  o: Outfit,
  opts: { expr?: Expr; blink?: boolean; facing?: -1 | 1; light?: number; seed?: number; device: "phone" | "keycard" | "none"; tap?: number }
) {
  const { expr = "neutral", blink = false, facing = 1, light = -2.1, seed = 1, device, tap = 0 } = opts;
  const skin = o.skin ?? "#ffe2c2";
  const H = headBlob(seed, 118, facing);
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const sole = 975, torsoBot = sole - 1.4 * HH, chin = torsoBot - 1.1 * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const ow = 5 * u, thick = thickAngle(light);
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5);

  // Legs
  for (const s of [-1, 1]) {
    const hx = 300 + s * 15 * u, fx = 300 + s * 22 * u, fy = sole - 4 * u;
    p.stroke([[hx, hipY], [fx, fy]], 5.8 * u, legCol);
    p.stroke([[fx - s * 3 * u, fy], [fx + s * 13 * u, fy]], 7.5 * u + 3, INK);
    p.stroke([[fx - s * 3 * u, fy], [fx + s * 13 * u, fy]], 7.5 * u, o.boots);
  }

  // Torso
  const T = { a: (0.8 / 2) * W / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);

  // Left arm (holding device if phone/keycard, else relaxed)
  const shL: [number, number] = [tcx - 0.85 * T.a, chin + 0.12 * HH];
  const shR: [number, number] = [tcx + 0.85 * T.a, chin + 0.12 * HH];
  const devX = tcx + facing * 1.45 * T.a + facing * 12 * u;
  const devY = chin + 0.42 * HH;

  // Back arm
  if (device === "none") {
    p.stroke([shL, [shL[0] - 12 * u, shL[1] + 0.9 * HH]], 5.2 * u, armCol);
    p.dot(shL[0] - 12 * u, shL[1] + 0.9 * HH, 5.5 * u);
  } else {
    p.stroke([shL, [tcx + facing * 0.6 * T.a, devY + 18 * u], [devX - facing * 10 * u, devY + 12 * u]], 5.2 * u, armCol);
  }

  p.gradFill(tp, o.jacket, mul(o.jacket, [0.64, 0.66, 0.74]), light);
  p.inkRing(tp, ow, thick);

  // Device + Tapping hand!
  if (device === "phone") {
    const px = devX, py = devY;
    p.poly([[px - 22 * u, py - 34 * u], [px + 22 * u, py - 34 * u], [px + 22 * u, py + 34 * u], [px - 22 * u, py + 34 * u]], "#252936", 3 * u);
    p.poly([[px - 17 * u, py - 27 * u], [px + 17 * u, py - 27 * u], [px + 17 * u, py + 23 * u], [px - 17 * u, py + 23 * u]], "#5cd0ff", 0);
    // Tapping right arm & finger
    const tapOff = tap * 10 * u;
    const handX = px - facing * (6 * u + tapOff), handY = py - 4 * u - tapOff * 0.5;
    p.stroke([shR, [shR[0] + facing * 18 * u, shR[1] + 28 * u], [handX, handY]], 5.2 * u, armCol);
    p.dot(handX, handY, 5.5 * u);
  } else if (device === "keycard") {
    const px = devX, py = devY;
    p.poly([[px - 24 * u, py - 15 * u], [px + 24 * u, py - 15 * u], [px + 24 * u, py + 15 * u], [px - 24 * u, py + 15 * u]], "#f7c948", 3 * u);
    p.poly([[px - 24 * u, py - 6 * u], [px + 24 * u, py - 6 * u], [px + 24 * u, py + 2 * u], [px - 24 * u, py + 2 * u]], "#241726", 0);
    p.stroke([shR, [shR[0] + facing * 18 * u, shR[1] + 24 * u], [px, py]], 5.2 * u, armCol);
    p.dot(px, py, 5.5 * u);
  } else {
    p.stroke([shR, [shR[0] + 12 * u, shR[1] + 0.9 * HH]], 5.2 * u, armCol);
    p.dot(shR[0] + 12 * u, shR[1] + 0.9 * HH, 5.5 * u);
  }

  // Head + hat + face
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, [0.96, 0.86, 0.84]), light, H.a);
  p.inkRing(hp, ow, thick);
  const cut = (hc - H.b) + (o.hat === "cap" ? 0.32 : 0.42) * HH;
  const keep = (_x: number, y: number) => y < cut;
  const n = hp.length, si = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
  const arc = [...hp.slice(si), ...hp.slice(0, si)].filter(([x, y]) => keep(x, y)).map(([x, y]) => [300 + (x - 300) * 1.04, hc + (y - hc) * 1.04] as [number, number]);
  if (arc.length >= 3) {
    const col = o.hat === "cap" ? (o.hatCol ?? "#1c5a8a") : (o.hair ?? "#2b2024");
    p.shadedFill(arc, col, mul(col, [0.62, 0.62, 0.7]), light, H.a, 0.35);
    p.poly(arc, null, ow * 0.85);
    if (o.hat === "cap") p.ell(300 + facing * 4 * u, cut + 1.5 * u, 32 * u, 0.06 * HH, shade(col, 0.8), ow * 0.85, 0, 180, 0);
  }

  // Eyes & mouth
  const fx = 300 + 7 * u * facing, ex = 13 * u, ey = hc;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    if (blink && expr !== "relief") p.stroke([[x - 8 * u, ey], [x + 8 * u, ey]], 3.8 * u);
    else if (expr === "shock") { p.ell(x, ey, 11 * u, 11 * u, "#ffffff", 2.6 * u); p.dot(x, ey + u, 3 * u); }
    else if (expr === "relief") p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, 3.8 * u);
    else p.ell(x, ey, 3.8 * u, 5.5 * u, INK, 0);
    p.stroke([[x - 8 * u, ey - 18 * u], [x + 8 * u, ey - (expr === "shock" ? 23 : 17) * u]], 4 * u);
  }
  const mx = 300 + 8 * u * facing, my = hc + 20 * u;
  if (expr === "shock") p.ell(mx, my + 2 * u, 8 * u, 10 * u, "#5a1e28", 3 * u);
  else if (expr === "smile" || expr === "relief") p.arc(mx, my - 3 * u, 8 * u, 4.5 * u, 20, 160, 4 * u);
  else if (expr === "nervous") p.arc(mx, my + 3 * u, 6.5 * u, 3.5 * u, 200, 340, 4 * u);
  else p.stroke([[mx - 5 * u, my], [mx + 5 * u, my]], 4 * u);
}

const fxUrlCard = (p: Pen, url: string, bg: string, fg: string, badge?: string) => {
  p.poly([[6, 12], [506, 12], [506, 116], [6, 116]], bg, 6);
  const g = p.g;
  if (badge) {
    g.fillStyle = badge; g.fillRect(14, 20, 120, 88);
    g.fillStyle = "#ffffff"; g.font = "900 22px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("URL", 74, 64);
    g.fillStyle = fg; g.font = "900 28px monospace"; g.textAlign = "left";
    g.fillText(url, 152, 64, 336);
  } else {
    g.fillStyle = fg; g.font = "900 30px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(url, 256, 64, 460);
  }
};

export function stage(id: number, f: number, sim: IdorSim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const t = f / FPS;
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 4 || id === 5 || id === 8 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;

  const addStick = (key: string, pos: V3, o: Outfit, opts: {
    expr?: Expr; facing?: -1 | 1; seed?: number; device: "phone" | "keycard" | "none"; tap?: number;
  }) => {
    const [x, y, z] = pos;
    const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1, z));
    const seed = opts.seed ?? 1;
    const blink = blinkAt(seed, f);
    const sx = cam.sun.dot(cam.right), sy = -cam.sun.y;
    const l2d = Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
    const expr = opts.expr ?? "neutral";
    const tapQ = Math.round((opts.tap ?? 0) * 4) / 4;
    places.push({
      key: `${key}|${expr}|${opts.device}|${tapQ}|${blink ? 1 : 0}|${l2d.toFixed(2)}`,
      x, y, z, size: tier(d),
      draw: (p) => drawDeviceStickman(p, o, { ...opts, tap: tapQ, blink, light: l2d }),
    });
    fx.push({ key: `blob|${blobAlpha}`, cw: 64, ch: 64, x, y: y + 0.02, z, w: 1.0, h: 0.7, flat: true, draw: (p) => fxBlob(p, 64, 64, blobAlpha) });
  };

  if (id === 5) {
    // Hotel lobby analogy! Stickman B holds yellow keycard at x=28, z=1.5
    const tap = 0.5 + 0.5 * Math.sin(t * 7);
    addStick("hotelB", [28.0, 0, 1.5], USER_B, { expr: "smile", facing: 1, seed: 9, device: "keycard", tap });
    fx.push({ key: "keyBadge", cw: 512, ch: 128, x: 28.0, y: 2.85, z: 1.5, w: 2.3, h: 0.58, draw: (p) => fxUrlCard(p, "LOBBY KEYCARD: OK!", "#fff8dc", INK) });
    return { places, fx };
  }

  // Stickman A (blue, legitimate owner of #104) & Stickman B (orange, testing #105 on device)
  const tapA = id === 3 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
  const tapB = id === 1 || id === 4 || id === 6 || id === 7 || id === 8 ? 0.5 + 0.5 * Math.sin(t * 10) : 0;

  if (id !== 4) {
    const exprA: Expr = id === 3 && sim.aOpen104 > 0.3 ? "relief" : id >= 6 ? "smile" : "neutral";
    addStick("userA", [-1.55, 0, 0.8], USER_A, { expr: exprA, facing: 1, seed: 3, device: "phone", tap: tapA });
  }
  if (id !== 3) {
    const exprB: Expr = id === 1 && f >= 165 ? "shock" : id === 4 && sim.bOpen105 > 0.3 ? "shock" : id === 6 && sim.block403 > 0.3 ? "nervous" : id === 7 ? "nervous" : id === 8 ? "nervous" : "smile";
    addStick("userB", [1.55, 0, 0.8], USER_B, { expr: exprB, facing: -1, seed: 9, device: "phone", tap: tapB });
  }

  // Floating browser/app URL cards mimicking the stickman's device taps!
  if (id === 1) {
    const url = f < 45 ? "/orders/104" : "/orders/105 !";
    const bg = f < 45 ? "#eef4fa" : "#ffe6e6";
    fx.push({ key: `u1_${f < 45 ? 0 : 1}`, cw: 512, ch: 128, x: 0.9, y: 2.75, z: 0.8, w: 2.2, h: 0.55, draw: (p) => fxUrlCard(p, url, bg, INK, "#d9534f") });
    if (f >= 165) fx.push({ key: "q1", cw: 128, ch: 128, x: 0, y: 3.1, z: -2.0, w: 1.0, h: 1.0, draw: (p) => fxAlert(p, "quest") });
  } else if (id === 3) {
    fx.push({ key: "u3", cw: 512, ch: 128, x: -1.1, y: 2.75, z: 0.8, w: 2.2, h: 0.55, draw: (p) => fxUrlCard(p, "/orders/104", "#e8fff1", INK, "#2bb673") });
  } else if (id === 4) {
    const edited = sim.bEditUrl > 0.5;
    fx.push({
      key: `u4_${edited ? 1 : 0}`, cw: 512, ch: 128, x: 1.1, y: 2.75, z: 0.8, w: 2.2, h: 0.55,
      draw: (p) => fxUrlCard(p, edited ? "/orders/105" : "/orders/104", edited ? "#fff0d6" : "#eef4fa", INK, "#e88835"),
    });
  } else if (id === 6) {
    if (sim.block403 > 0.3) {
      fx.push({ key: "u6", cw: 512, ch: 128, x: 0.85, y: 2.75, z: 0.8, w: 2.25, h: 0.56, draw: (p) => fxUrlCard(p, "403 FORBIDDEN!", "#d94545", "#ffffff") });
    }
  } else if (id === 7) {
    const url = sim.uuidFlip > 0.5 ? "/orders/a8f3-9c1e" : "/orders/104..106";
    fx.push({ key: `u7_${sim.uuidFlip > 0.5 ? 1 : 0}`, cw: 512, ch: 128, x: 0.85, y: 2.75, z: 0.8, w: 2.35, h: 0.58, draw: (p) => fxUrlCard(p, url, "#eef4fa", INK, "#2b6cb0") });
  } else if (id === 8) {
    fx.push({ key: "u8", cw: 512, ch: 128, x: 0.0, y: 2.85, z: 0.8, w: 2.45, h: 0.6, draw: (p) => fxUrlCard(p, "SA'YO BA 'TO? 403", "#d94545", "#ffffff") });
  }

  return { places, fx };
}

export { Actor, Fx, Pool };
