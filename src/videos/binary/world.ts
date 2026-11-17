// 3D world for "Binary Search Explained" featuring a scrambling/sorting 9-pillar staircase [01..100], physical halving sink animations, & golden #73 prize spotlight.
import * as THREE from "three";
import { Batch, boxGeo, lam, quad, V } from "../paxsilica/build";
import { NOINK } from "../paxsilica/ink";
import { LIGHTS, LightPreset, LOOK } from "../paxsilica/lights";
import { cloudHD, ctex, grassHD, rep, stoneHD } from "../paxsilica/paint";
import { CHAR, TONE, twoTone, untone } from "../paxsilica/shade";
import { Actor, Fx, Pool, stage } from "./cast";
import { camAt, SHOTS, ShotDef, simAt } from "./story";

const discTex = () => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
};

const haloTex = () => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const g = cv.getContext("2d")!, im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
  return new THREE.CanvasTexture(cv);
};

const signBoard = (key: string, top: string, sub: string, bg: string, accent: string) =>
  ctex("bin_sgn_" + key, 512, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = accent; g.fillRect(22, 22, 468, 66);
    g.fillStyle = "#ffffff"; g.font = "900 32px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(top, 256, 67, 440);
    g.fillStyle = "#241726"; g.font = "900 40px system-ui, sans-serif";
    g.fillText(sub, 256, 176, 440);
  });

const numPlaque = (n: number, col: string) =>
  ctex("bin_n_" + n + col, 160, 160, (g) => {
    g.fillStyle = col; g.fillRect(0, 0, 160, 160);
    g.strokeStyle = "#241726"; g.lineWidth = 12; g.strokeRect(8, 8, 144, 144);
    g.fillStyle = "#241726"; g.font = "900 68px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n).padStart(2, "0"), 80, 82, 130);
  });

const VALS = [1, 12, 25, 38, 50, 63, 73, 75, 100];
// Scrambled visual slot order shown briefly in Shot 3 before snapping cleanly to [0..8]
const SCRAMBLED_SLOT = [6, 2, 8, 0, 5, 3, 7, 1, 4];

export class BinaryWorld {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sunDisc: THREE.Sprite;
  private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];

  private pillars: THREE.Group[] = [];
  private pillarMeshes: THREE.Mesh[] = [];
  private pointerOrb: THREE.Mesh;
  private prizeStar: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sph = new THREE.Sphere();

  constructor() {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);

    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }

    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);

    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 115 + (i % 4) * 34, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    const b = new Batch();
    const grass = lam("bin_grass", () => ({ map: rep(grassHD(), 32, 32) }));
    const stageFloor = lam("bin_stage", () => ({ map: rep(stoneHD("bin_st", ["#dfd7ca", "#d2c9ba", "#e7dfd3", "#c8bfae"], "#a09586"), 6, 6) }));
    const wallMat = lam("bin_wall", () => ({ color: "#3d4c66" }));
    const goldMat = lam("bin_gold", () => ({ color: "#e5b84b" }));
    const trackMat = lam("bin_trk", () => ({ color: "#2d89c8" }));
    const hillMat = lam("bin_hill", () => ({ color: "#6c9e79" }));

    b.add(quad(V(-200, 0, 200), V(200, 0, 200), V(200, 0, -200), V(-200, 0, -200), 25, 25), grass);
    b.add(boxGeo(V(-6.5, 0, -9.5), V(6.5, 0.14, 4.5), 4), stageFloor);
    b.add(boxGeo(V(-4.6, 0.14, -1.2), V(4.6, 0.24, -0.4)), trackMat); // hero jump track

    for (let i = 0; i < 7; i++) {
      const m = new THREE.IcosahedronGeometry(30 + (i % 3) * 8, 2);
      m.scale(1.3, 0.65, 0.9);
      b.add(m, hillMat, new THREE.Matrix4().makeTranslation(-95 + i * 32, 3, -115 - (i % 2) * 18));
    }

    // Tall Arcade / Library Backdrop Wall behind the 9 staircase blocks
    b.add(boxGeo(V(-5.2, 0.14, -7.8), V(5.2, 7.6, -6.5), 2), wallMat);
    b.add(boxGeo(V(-5.4, 7.6, -7.9), V(5.4, 8.05, -6.4)), goldMat);
    b.build(R);

    const headerSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.5),
      new THREE.MeshBasicMaterial({ map: signBoard("hdr", "SORTED LIST [1..100]", "BINARY SEARCH O(log n)", "#eef4fa", "#2b6cb0"), side: THREE.DoubleSide })
    );
    headerSign.position.set(0, 6.2, -6.42); headerSign.layers.set(NOINK);
    R.add(headerSign);

    // Build the 9 colorful sorted pillars at z = -4.6 (pivoted from floor y = 0.14)
    const cols = ["#4a8fd4", "#559ce0", "#61a8ea", "#6fb4f2", "#e5b84b", "#3cc484", "#ffd54f", "#e88835", "#c85a68"];
    for (let i = 0; i < VALS.length; i++) {
      const g = new THREE.Group();
      const h = 1.45 + i * 0.28;
      const mat = lam("bin_p_" + i, () => ({ color: cols[i] }));
      const m = new THREE.Mesh(boxGeo(V(-0.37, 0, -0.42), V(0.37, h, 0.42)), mat);
      m.castShadow = true;
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: numPlaque(VALS[i], VALS[i] === 73 ? "#fff4b8" : "#fffdf6"), side: THREE.DoubleSide })
      );
      badge.position.set(0, h - 0.42, 0.44); badge.layers.set(NOINK);
      g.add(m, badge);
      g.position.set(-3.6 + i * 0.9, 0.14, -4.6);
      R.add(g);
      this.pillars.push(g);
      this.pillarMeshes.push(m);
    }

    // Glowing Target/Mid Beacon Orb & Winning Prize Star above #73
    this.pointerOrb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.3) }));
    this.prizeStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 1.2) }));
    this.pointerOrb.layers.set(NOINK); this.prizeStar.layers.set(NOINK);
    R.add(this.pointerOrb, this.prizeStar);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 5) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], sim = simAt(f);
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);

    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 10, 16, 85);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);

    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }

    // ---- Dynamic Pillar Sort + Halving Drops ----
    const sortT = id === 3 ? sim.sortSnap : 1;
    const cutL = id >= 5 && id <= 7 ? sim.cutLeft : 0;
    const cutR = id >= 6 && id <= 7 ? sim.cutRight : 0;
    for (let i = 0; i < VALS.length; i++) {
      const xSorted = -3.6 + i * 0.9;
      const xScram = -3.6 + SCRAMBLED_SLOT[i] * 0.9;
      const g = this.pillars[i];
      g.position.x = xScram + (xSorted - xScram) * sortT;
      let drop = 0;
      if (i <= 4) drop = cutL;
      else if (i >= 7) drop = cutR;
      g.scale.y = 1 - drop * 0.72;
      g.position.y = 0.14 - drop * 0.1;
    }

    // Floating MID pointer & #73 Found Star!
    this.pointerOrb.visible = id >= 4 && id <= 7;
    if (id === 4 || id === 5) this.pointerOrb.position.set(0.0, 3.15 + Math.sin(f * 0.2) * 0.15, -4.6);
    else if (id === 6) this.pointerOrb.position.set(2.7, 3.95 + Math.sin(f * 0.2) * 0.15, -4.6);
    else if (id === 7) this.pointerOrb.position.set(1.8, 3.7 + Math.sin(f * 0.2) * 0.15, -4.6);

    const boom = id >= 7 && sim.hit73 > 0.7;
    this.prizeStar.visible = boom;
    if (boom) {
      this.prizeStar.position.set(1.8, 3.85 + Math.sin(f * 0.18) * 0.2, -4.6);
      this.prizeStar.rotation.y = f * 0.08;
    }

    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, f, sim, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));

    let ai = 0;
    const used: Actor[] = [];
    for (const pl of st.places) {
      const sc2 = pl.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(pl.x, pl.y + 1.1 * sc2, pl.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = pl.size ?? [300, 500, 0.5];
      a.r = this.pool.req(pl.key, w, h, k, pl.draw);
      a.mesh.visible = true;
      a.mesh.position.set(pl.x, pl.y, pl.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - pl.x, cam.position.z - pl.z), 0);
      a.mesh.scale.set(sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;

    let fi = 0;
    const fused: Fx[] = [];
    for (const pl of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(pl.x, pl.y, pl.z), Math.max(pl.w, pl.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(pl.key, pl.cw, pl.ch, 1, pl.draw);
      e2.mesh.visible = true;
      e2.mesh.position.set(pl.x, pl.y, pl.z);
      if (pl.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, 0);
      else e2.mesh.quaternion.copy(cam.quaternion);
      e2.mesh.scale.set(pl.w, pl.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;

    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }
}
