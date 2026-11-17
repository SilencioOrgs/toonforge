// 2D bean-head cast (User A, User B) + phone/check/reject/friendly-message FX cards.
import * as THREE from "three";
import { LIGHTS } from "../paxsilica/lights";
import { Actor, Fx, Pool } from "../paxsilica/cast";
import { bodyFront, Expr, fxAlert, fxBlob, INK, Outfit, Pen } from "../paxsilica/toon";
import { V3 } from "../paxsilica/story";
import { FPS, RaceSim } from "./story";

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const USER_A: Outfit = { jacket: "#2d89c8", pants: "#2e3545", boots: "#231e24", hat: "cap", hatCol: "#1c5a8a", skin: "#e8be96" };
const USER_B: Outfit = { jacket: "#e07a34", pants: "#3b3f52", boots: "#2d2420", hat: "hair", hair: "#2b2024", skin: "#d9a579" };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : [480, 800, 0.8];

const blinkAt = (seed: number, f: number) => ((f + seed * 17) % 61) < 4;

const fxReject = (p: Pen) => {
  p.ell(64, 64, 48, 48, "#d94545", 6);
  p.stroke([[40, 40], [88, 88]], 11, "#ffffff");
  p.stroke([[88, 40], [40, 88]], 11, "#ffffff");
};

const fxPhoneMsg = (p: Pen, text: string, bg: string, fg: string) => {
  p.poly([[8, 16], [248, 16], [248, 112], [8, 112]], bg, 6);
  const g = p.g;
  g.fillStyle = fg;
  g.font = "900 22px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 64, 218);
};

export function stage(id: number, f: number, sim: RaceSim, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const t = f / FPS;
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 4 || id === 7 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;

  const addActor = (key: string, pos: V3, o: Outfit, opts: { expr?: Expr; mode?: "stroll" | "stand"; phase?: number; facing?: -1 | 0 | 1; wave?: number; seed?: number } = {}) => {
    const [x, y, z] = pos;
    const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1, z));
    const seed = opts.seed ?? 1;
    const blink = blinkAt(seed, f);
    const sx = cam.sun.dot(cam.right), sy = -cam.sun.y;
    const l2d = Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
    const expr = opts.expr ?? "neutral";
    const wv = opts.wave !== undefined ? Math.round(opts.wave * 10) / 10 : undefined;
    places.push({
      key: `${key}|${expr}|${opts.mode ?? "stand"}|${blink ? 1 : 0}|${wv ?? "n"}|${l2d.toFixed(2)}`,
      x, y, z, size: tier(d),
      draw: (p) => bodyFront(p, o, { ...opts, blink, light: l2d }),
    });
    fx.push({ key: `blob|${blobAlpha}`, cw: 64, ch: 64, x, y: y + 0.02, z, w: 1.0, h: 0.7, flat: true, draw: (p) => fxBlob(p, 64, 64, blobAlpha) });
  };

  // User A (Blue) & User B (Orange) flanking VIP Seat #A1
  const exprA: Expr = f >= 148 && f < 210 ? "shock" : f >= 1020 ? "relief" : f >= 80 && f < 148 ? "smile" : f >= 600 && f < 738 ? "shock" : "smile";
  const exprB: Expr = f >= 148 && f < 210 ? "shock" : f >= 1078 ? "nervous" : f >= 80 && f < 148 ? "smile" : f >= 600 && f < 738 ? "shock" : "neutral";
  const ax = f >= 1025 && (id === 6 || id === 8) ? -1.6 : -2.1;

  addActor("userA", [ax, 0, 0.5], USER_A, { expr: exprA, facing: 1, seed: 3, wave: id === 6 && f < 1075 ? Math.sin(t * 7) * 0.5 : undefined });
  addActor("userB", [2.1, 0, 0.5], USER_B, { expr: exprB, facing: -1, seed: 9 });

  // Shot 1: double confirmation + shock ?
  if (id === 1 && sim.doubleConfirm > 0.3) {
    const bob = Math.sin(t * 5) * 0.1;
    fx.push({ key: "okA", cw: 256, ch: 128, x: -2.1, y: 2.85 + bob, z: 0.5, w: 1.4, h: 0.7, draw: (p) => fxPhoneMsg(p, "CONFIRMED!", "#2bb673", "#ffffff") });
    fx.push({ key: "okB", cw: 256, ch: 128, x: 2.1, y: 2.85 + bob, z: 0.5, w: 1.4, h: 0.7, draw: (p) => fxPhoneMsg(p, "CONFIRMED!", "#2bb673", "#ffffff") });
    if (f >= 148) fx.push({ key: "quest", cw: 128, ch: 128, x: 0, y: 2.75 + bob, z: 0, w: 1.0, h: 1.0, draw: (p) => fxAlert(p, "quest") });
  }

  // Shot 4: double-booking alert
  if (id === 4 && f > 615) {
    fx.push({ key: "warnSeat", cw: 128, ch: 128, x: 0, y: 2.8 + Math.sin(t * 7) * 0.12, z: 0, w: 1.05, h: 1.05, draw: (p) => fxAlert(p, "warn") });
  }

  // Shot 6: Row=1 wins for User A, Row=0 loses for User B
  if (id === 6) {
    if (sim.rowOneWin > 0.3) {
      fx.push({ key: "row1", cw: 256, ch: 128, x: ax, y: 2.85, z: 0.5, w: 1.5, h: 0.75, draw: (p) => fxPhoneMsg(p, "ROW = 1 (SA'YO)", "#2bb673", "#ffffff") });
    }
    if (sim.rowZeroLose > 0.3) {
      fx.push({ key: "row0", cw: 256, ch: 128, x: 2.1, y: 2.85, z: 0.5, w: 1.6, h: 0.8, draw: (p) => fxPhoneMsg(p, "ROW = 0 (TAKEN)", "#d94545", "#ffffff") });
    }
  }

  // Shot 7: DB rejects second booking even with bug
  if (id === 7 && sim.bugReject > 0.45) {
    fx.push({ key: "fxRej", cw: 128, ch: 128, x: 1.2, y: 3.1, z: -7.5, w: 1.0, h: 1.0, draw: fxReject });
  }

  // Shot 8: Friendly message bubble above User B
  if (id === 8 && sim.friendlyMsg > 0.4) {
    fx.push({ key: "friendly", cw: 256, ch: 128, x: 2.1, y: 2.95, z: 0.5, w: 1.85, h: 0.92, draw: (p) => fxPhoneMsg(p, "KAKAKUHA LANG :)", "#fff5dc", INK) });
  }

  return { places, fx };
}

export { Actor, Fx, Pool };
