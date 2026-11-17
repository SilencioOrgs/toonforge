// Lit flat 2D cast billboards + contact blobs + symbolic alert effects for the Pax Silica + Aeta short.
import * as THREE from "three";
import { AETA, AETA_ELDER, bodyFront, ENGINEER, Expr, fxAlert, fxBlob, OFFICIAL, Pen, Prop, WORKER } from "./toon";
import { FPS, SimState, V3 } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { blobMaterial, cardShade, CARD_K } from "./cardshade";

type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };

const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};

export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216;
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}

export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t; this.mesh.material = this.mat; this.mesh.renderOrder = 2;
    }
  }
}

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; size?: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const tier = (d: number): [number, number, number] =>
  d < 4 ? [1500, 2500, 2.5] : d < 10 ? [900, 1500, 1.5] : d < 22 ? [480, 800, 0.8] : [240, 400, 0.4];

const blinkAt = (seed: number, f: number) => {
  const period = 45 + (seed * 17) % 42;
  const ph = (f + seed * 13) % period;
  return ph < 4;
};

export function stage(id: number, f: number, sim: SimState, cam: CamInfo): { places: Place[]; fx: FxPlace[] } {
  const t = f / FPS;
  const places: Place[] = [];
  const fx: FxPlace[] = [];
  const lightName = id === 6 || id === 7 || id === 10 ? "golden" : "day";
  const blobAlpha = LIGHTS[lightName].actorShadow ? 0.16 : 0.28;

  const addActor = (key: string, pos: V3, o: ReturnType<typeof WORKER>, opts: {
    expr?: Expr; mode?: "stroll" | "stand"; phase?: number; prop?: Prop; facing?: -1 | 0 | 1; wave?: number; seed?: number; scale?: number;
  } = {}) => {
    const [x, y, z] = pos;
    const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1, z));
    const seed = opts.seed ?? 1;
    const blink = blinkAt(seed, f);
    const sx = cam.sun.dot(cam.right), sy = -cam.sun.y;
    const l2d = Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
    const ph = opts.mode === "stroll" ? Math.round(((opts.phase ?? 0) % 1) * 16) / 16 : 0;
    const wv = opts.wave !== undefined ? Math.round(opts.wave * 10) / 10 : undefined;
    const expr = opts.expr ?? "neutral";
    const fullKey = `${key}|${expr}|${opts.mode ?? "stand"}|${ph}|${blink ? 1 : 0}|${opts.prop ?? "n"}|${wv ?? "n"}|${l2d.toFixed(2)}`;
    places.push({
      key: fullKey,
      x, y, z, scale: opts.scale ?? 1, size: tier(d),
      draw: (p) => bodyFront(p, o, { ...opts, phase: ph, blink, light: l2d }),
    });
    fx.push({ key: `blob|${blobAlpha}`, cw: 64, ch: 64, x, y: y + 0.02, z, w: 1.0, h: 0.7, flat: true, draw: (p) => fxBlob(p, 64, 64, blobAlpha) });
  };

  // Legacy assembly workers outside shop (Shots 1-3)
  if (id <= 3) {
    addActor("wk0", [-7.2, 0, 13.4], WORKER(0), { expr: "neutral", prop: "box", facing: -1, seed: 2 });
    addActor("wk1", [-10.8, 0, 13.2], WORKER(1), { expr: "smile", mode: "stroll", phase: t * 0.6, facing: 1, seed: 3 });
  }

  // Cleanroom engineers (Shots 4-5, 8-10)
  if (id >= 4) {
    const walk = t * 0.55;
    addActor("eng0", [-10.5 + Math.sin(walk) * 0.9, 0, 5.5], ENGINEER(0), { expr: "smile", mode: "stroll", phase: walk, prop: "wafer", facing: 1, seed: 5 });
    addActor("eng1", [-8.2, 0, 4.2], ENGINEER(1), { expr: "neutral", prop: "clipboard", facing: -1, seed: 6 });
    addActor("eng2", [-14.0, 0, -2.5], ENGINEER(2), { expr: "smile", mode: "stand", facing: 1, seed: 7 });
  }

  // Aeta farmers & community in Capas foothills (always present!)
  const aetaExpr: Expr = id === 6 ? "nervous" : id === 7 ? "stern" : id >= 8 ? "relief" : "smile";
  const aetaProp = (i: number): Prop => (id === 7 ? (i % 2 === 0 ? "signWater" : "signLand") : i === 0 ? "hoe" : null);
  const protestShift = id === 7 ? -2.4 : 0;

  addActor("aeta0", [15.8 + protestShift, 0, 1.5], AETA(0), { expr: aetaExpr, prop: aetaProp(0), facing: -1, seed: 11, wave: id === 7 ? Math.sin(t * 5) * 0.5 : undefined });
  addActor("aeta1", [16.5 + protestShift, 0, -1.8], AETA(1), { expr: id === 6 ? "shock" : aetaExpr, prop: aetaProp(1), facing: -1, seed: 12 });
  addActor("aeta2", [18.0 + protestShift * 0.6, 0.05, 4.2], AETA(2), { expr: aetaExpr, prop: id === 7 ? "signWater" : null, facing: -1, seed: 13 });
  addActor("aeta3", [19.4, 0.15, -7.2], AETA(3), { expr: id >= 8 ? "smile" : "nervous", facing: -1, seed: 14 });

  // Aeta elder & PH/NCIP official dialogue at the boundary bridge (Shots 6-10)
  if (id >= 6 && id <= 9) {
    const elderX = id >= 8 ? 11.2 : 16.0;
    addActor("elder", [elderX, 0, 0.2], AETA_ELDER, { expr: id >= 8 ? "smile" : "stern", facing: -1, seed: 19 });
  }
  if (id >= 8 && id <= 9) {
    addActor("official", [9.2, 0, 0.2], OFFICIAL, { expr: "smile", prop: "clipboard", facing: 1, seed: 23 });
  }

  // Symbolic 2D alert icons floating smoothly above key beats (zero text!)
  if (id === 6) {
    const bob = Math.sin(t * 4) * 0.14;
    fx.push({ key: "fxQuest", cw: 128, ch: 128, x: 16.0, y: 2.85 + bob, z: 0.2, w: 0.9, h: 0.9, draw: (p) => fxAlert(p, "quest") });
  } else if (id === 7) {
    const bob = Math.sin(t * 6) * 0.12;
    fx.push({ key: "fxWarn", cw: 128, ch: 128, x: 14.2, y: 3.1 + bob, z: 0.6, w: 0.95, h: 0.95, draw: (p) => fxAlert(p, "warn") });
  } else if ((id === 8 || id === 9) && sim.safeguard > 0.5) {
    fx.push({ key: "fxCheck", cw: 128, ch: 128, x: 10.2, y: 2.95, z: 0.2, w: 0.9, h: 0.9, draw: (p) => fxAlert(p, "check") });
  }

  return { places, fx };
}
