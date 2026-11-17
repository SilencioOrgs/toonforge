// Static 3D diorama geometry for Tarlac / New Clark City / Aeta foothills (no external GLB dependencies).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { asphaltHD, bambooWallHD, cleanroomHD, grassHD, nipaThatchHD, rep, rng, soilPlotHD, stoneHD, woodHD } from "./paint";
import { twoTone } from "./shade";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};

const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};

export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1], 2));
  return g;
};

export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

export const hillY = (x: number, z: number) => {
  if (x <= 18) return 0;
  const u = Math.min(1, (x - 18) / 55);
  return u * u * 16 + Math.max(0, Math.sin(z * 0.08) * 1.4 * u);
};

export function buildTarlacScene(root: THREE.Object3D) {
  const b = new Batch();
  const grass = lam("grassHD", () => ({ map: rep(grassHD(), 40, 40) }));
  const hillGrass = lam("hillGrass", () => ({ map: rep(grassHD(), 16, 16), color: "#68ab4f" }));
  const road = lam("asphalt", () => ({ map: rep(asphaltHD(), 1, 14) }));
  const soil = lam("soilPlot", () => ({ map: rep(soilPlotHD(), 2, 2) }));
  const bamboo = lam("bamboo", () => ({ map: rep(bambooWallHD(), 1.5, 1) }));
  const nipa = lam("nipa", () => ({ map: rep(nipaThatchHD(), 2, 1.5) }));
  const wood = lam("wood", () => ({ map: rep(woodHD(), 1, 1) }));
  const stone = lam("stone", () => ({ map: rep(stoneHD(), 2, 1) }));
  const bark = lam("bark", () => ({ color: "#7d5235" }));
  const leafA = lam("leafA", () => ({ color: "#589e44" }));
  const leafB = lam("leafB", () => ({ color: "#6ab34e" }));
  const legacyWall = lam("legacyWall", () => ({ color: "#c99f74" }));
  const legacyRoof = lam("legacyRoof", () => ({ color: "#7e5544" }));
  const crateMat = lam("crate", () => ({ color: "#d5a36c" }));
  const craneMat = lam("crane", () => ({ color: "#d97336" }));
  const containerBlue = lam("contB", () => ({ color: "#3d72a8" }));
  const containerRed = lam("contR", () => ({ color: "#b64e42" }));

  // Valley floor on left (x: -240..4) & right bank (x: 8..20)
  b.add(quad(V(-240, 0, 240), V(4, 0, 240), V(4, 0, -240), V(-240, 0, -240), 30, 30), grass);
  b.add(quad(V(8, 0, 240), V(20, 0, 240), V(20, 0, -240), V(8, 0, -240), 2, 30), grass);

  // Stream banks (x = 4..8, bed at y = -1.2)
  b.add(quad(V(4, -1.2, 240), V(4, -1.2, -240), V(4, 0.05, -240), V(4, 0.05, 240), 20, 1), stone);
  b.add(quad(V(8, -1.2, -240), V(8, -1.2, 240), V(8, 0.05, 240), V(8, 0.05, -240), 20, 1), stone);
  b.add(quad(V(4, -1.2, 240), V(8, -1.2, 240), V(8, -1.2, -240), V(4, -1.2, -240), 2, 30), lam("bed", () => ({ color: "#8c7b5c" })));

  // Luzon Corridor Highway (Subic <-> Clark <-> Batangas) running along x = -22, plus feeder into zone
  b.add(quad(V(-26, 0.03, 180), V(-18, 0.03, 180), V(-18, 0.03, -180), V(-26, 0.03, -180), 1, 24), road);
  b.add(quad(V(-18, 0.035, 16), V(2, 0.035, 16), V(2, 0.035, 10), V(-18, 0.035, 10), 1, 2), road);

  // Small wooden footbridge crossing the stream at z = 0..3
  b.add(boxGeo(V(3.6, 0.25, -1.2), V(8.4, 0.45, 1.4), 2), wood);
  for (const x of [4.2, 7.8]) for (const z of [-1.0, 1.2]) b.add(boxGeo(V(x - 0.1, -0.6, z - 0.1), V(x + 0.1, 1.0, z + 0.1)), wood);

  // Distant foothills & Mt. Pinatubo-style backdrop ridges on right (x >= 18) and far back (z <= -90)
  const r = rng(42);
  const segX = 16, segZ = 24;
  for (let ix = 0; ix < segX; ix++) for (let iz = 0; iz < segZ; iz++) {
    const x0 = 18 + (ix / segX) * 90, x1 = 18 + ((ix + 1) / segX) * 90;
    const z0 = -120 + (iz / segZ) * 240, z1 = -120 + ((iz + 1) / segZ) * 240;
    const p00 = V(x0, hillY(x0, z0), z0), p10 = V(x1, hillY(x1, z0), z0);
    const p11 = V(x1, hillY(x1, z1), z1), p01 = V(x0, hillY(x0, z1), z1);
    b.add(quad(p01, p11, p10, p00, 1, 1), hillGrass);
  }
  for (let i = 0; i < 8; i++) {
    const px = -140 + i * 38, pz = -138 - (i % 3) * 22;
    const m = new THREE.IcosahedronGeometry(34 + (i % 3) * 10, 2);
    m.scale(1.3, 0.68, 0.9);
    b.add(m, lam("distHill", () => ({ color: "#6c9e79" })), new THREE.Matrix4().makeTranslation(px, 4, pz));
  }

  // Legacy small electronics assembly shop (Shot 2: "before approval") at (-11, 0, 18)
  b.add(boxGeo(V(-15, 0, 15), V(-7, 3.0, 22), 2), legacyWall);
  b.add(boxGeo(V(-15.4, 3.0, 14.6), V(-6.6, 3.6, 22.4), 2), legacyRoof);
  for (const [cx, cz] of [[-8.2, 13.8], [-9.4, 13.8], [-8.8, 12.6]]) {
    b.add(boxGeo(V(cx - 0.45, 0, cz - 0.45), V(cx + 0.45, 0.85, cz + 0.45)), crateMat);
  }

  // Port terminal silhouette in south distance (z = 68..84, representing Subic/Batangas port link)
  for (const [cx, col] of [[-28, containerBlue], [-25.2, containerRed], [-28, containerRed]] as const) {
    const y = cx === -28 && col === containerRed ? 1.5 : 0;
    b.add(boxGeo(V(cx - 1.1, y, 66), V(cx + 1.1, y + 1.5, 71)), col);
  }
  for (const x of [-31, -24]) {
    b.add(boxGeo(V(x - 0.3, 0, 74), V(x + 0.3, 12, 74.6)), craneMat);
    b.add(boxGeo(V(x - 0.3, 10.5, 67), V(x + 0.3, 11.1, 78)), craneMat);
  }

  // Aeta Foothills Village (Capas, Tarlac): stilt bamboo/nipa homes & terraced ancestral farm plots
  const huts: [number, number, number][] = [
    [22, 0.6, -5], [27, 1.5, 3], [24, 1.0, 11], [32, 2.4, -10], [34, 2.8, 7],
  ];
  for (const [hx, hy, hz] of huts) {
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.2, 1.2]) {
      b.add(boxGeo(V(hx + sx - 0.1, hy - 0.8, hz + sz - 0.1), V(hx + sx + 0.1, hy + 0.7, hz + sz + 0.1)), wood);
    }
    b.add(boxGeo(V(hx - 1.7, hy + 0.7, hz - 1.5), V(hx + 1.7, hy + 2.8, hz + 1.5), 2), bamboo);
    const roof = new THREE.ConeGeometry(2.7, 1.8, 4); roof.rotateY(Math.PI / 4);
    b.add(roof, nipa, new THREE.Matrix4().makeTranslation(hx, hy + 3.7, hz));
  }
  // Farm plots just west of the stream (x = 12..19)
  for (const [fx, fz] of [[14.5, -3], [14.5, 4.5], [14.5, -10]]) {
    b.add(boxGeo(V(fx - 2.3, 0, fz - 2.2), V(fx + 2.3, 0.16, fz + 2.2), 2), soil);
    for (let row = -1.5; row <= 1.5; row += 1.0) {
      b.add(boxGeo(V(fx - 1.9, 0.16, fz + row - 0.22), V(fx + 1.9, 0.42, fz + row + 0.22)), leafA);
    }
  }

  // Stylized tropical trees (round layered canopies, zero external GLB)
  const addTree = (x: number, z: number, sc = 1) => {
    const y = hillY(x, z);
    const trunk = new THREE.CylinderGeometry(0.18 * sc, 0.28 * sc, 2.2 * sc, 7);
    b.add(trunk, bark, new THREE.Matrix4().makeTranslation(x, y + 1.1 * sc, z));
    const c1 = new THREE.IcosahedronGeometry(1.35 * sc, 1);
    const c2 = new THREE.IcosahedronGeometry(0.95 * sc, 1);
    const mat = r() > 0.5 ? leafA : leafB;
    b.add(c1, mat, new THREE.Matrix4().makeTranslation(x, y + 2.7 * sc, z));
    b.add(c2, mat, new THREE.Matrix4().makeTranslation(x + 0.65 * sc, y + 3.2 * sc, z - 0.3 * sc));
  };
  for (const [tx, tz, sc] of [
    [19, -15, 1.2], [22, 16, 1.3], [29, -3, 1.1], [31, 14, 1.4], [38, -16, 1.5], [40, 2, 1.3],
    [43, 15, 1.6], [11, -18, 1.1], [11, 20, 1.2], [-34, -22, 1.4], [-36, 18, 1.3], [-42, -4, 1.5],
    [25, -24, 1.3], [35, 24, 1.4], [48, -8, 1.7], [52, 10, 1.6],
  ]) addTree(tx, tz, sc);

  b.build(root);
  return { cleanroomMat: lam("cleanroom", () => ({ map: rep(cleanroomHD(), 2, 1) })) };
}
