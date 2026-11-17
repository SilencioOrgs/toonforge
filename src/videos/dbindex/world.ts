// 3D world for "Database Indexing" featuring SEARCH API tower, 5-tier 1M-Row Table Rack, dropping golden B-Tree Index Pyramid, & pooled query orbs.
import * as THREE from "three";
import { Batch, boxGeo, lam, quad, V } from "../paxsilica/build";
import { NOINK } from "../paxsilica/ink";
import { LIGHTS, LightPreset, LOOK } from "../paxsilica/lights";
import { cloudHD, ctex, grassHD, rep, stoneHD } from "../paxsilica/paint";
import { CHAR, TONE, untone } from "../paxsilica/shade";
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
  ctex("dbi_sgn_" + key, 512, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = accent; g.fillRect(22, 22, 468, 66);
    g.fillStyle = "#ffffff"; g.font = "900 30px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(top, 256, 66, 440);
    g.fillStyle = "#241726"; g.font = "900 34px system-ui, sans-serif";
    g.fillText(sub, 256, 174, 440);
  });

const stationLabel = (key: string, title: string, bg: string, fg: string, fontPx = 36) =>
  ctex("dbi_lbl_" + key, 256, 96, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
    g.strokeStyle = "#241726"; g.lineWidth = 10; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = fg; g.font = `900 ${fontPx}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(title, 128, 49, 228);
  });

const ROW_LABELS = ["ROW #01", "ROW #02", "ROW #03", "ROW #742K ★", "ROW #1.0M"];

export class DbIndexWorld {
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

  private serverGrp = new THREE.Group();
  private dbGrp = new THREE.Group();
  private btreeGrp = new THREE.Group();
  private dbBeacon: THREE.Mesh;
  private btreeCrystal: THREE.Mesh;
  private rowLights: THREE.Mesh[] = [];
  private packets: THREE.Mesh[] = [];
  private hitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.5, 0.9) });
  private queryMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.35, 0.25) });
  private crashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.25, 0.25) });
  private okBeaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.8) });
  private idleLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.55, 0.7) });
  private goldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 0.35) });

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
    const grass = lam("dbi_grass", () => ({ map: rep(grassHD(), 32, 32) }));
    const stageFloor = lam("dbi_stage", () => ({ map: rep(stoneHD("dbi_st", ["#dfd7ca", "#d2c9ba", "#e7dfd3", "#c8bfae"], "#a09586"), 6, 6) }));
    const wallMat = lam("dbi_wall", () => ({ color: "#3d4c66" }));
    const goldBorderMat = lam("dbi_gold", () => ({ color: "#e5b84b" }));
    const laneMat = lam("dbi_lane", () => ({ color: "#2d89c8" }));
    const dbStepMat = lam("dbi_dbstep", () => ({ color: "#8c96a8" }));
    const hillMat = lam("dbi_hill", () => ({ color: "#6c9e79" }));

    b.add(quad(V(-200, 0, 200), V(200, 0, 200), V(200, 0, -200), V(-200, 0, -200), 25, 25), grass);
    b.add(boxGeo(V(-6.5, 0, -9.5), V(6.5, 0.14, 4.5), 4), stageFloor);
    b.add(boxGeo(V(-4.4, 0.14, -1.7), V(4.4, 0.24, -1.0)), laneMat);
    b.add(boxGeo(V(1.45, 0.14, -4.5), V(4.15, 0.65, -2.0)), dbStepMat);

    for (let i = 0; i < 7; i++) {
      const m = new THREE.IcosahedronGeometry(30 + (i % 3) * 8, 2);
      m.scale(1.3, 0.65, 0.9);
      b.add(m, hillMat, new THREE.Matrix4().makeTranslation(-95 + i * 32, 3, -115 - (i % 2) * 18));
    }
    b.add(boxGeo(V(-5.3, 0.14, -7.8), V(5.3, 7.6, -6.5), 2), wallMat);
    b.add(boxGeo(V(-5.5, 7.6, -7.9), V(5.5, 8.05, -6.4)), goldBorderMat);
    b.build(R);

    const headerSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.5),
      new THREE.MeshBasicMaterial({ map: signBoard("hdr", "DATABASE INDEXING", "FULL TABLE SCAN  vs  B-TREE INDEX", "#eef4fa", "#2bb673"), side: THREE.DoubleSide })
    );
    headerSign.position.set(0, 6.25, -6.42); headerSign.layers.set(NOINK);
    R.add(headerSign);

    // ---- Left Station: SEARCH API (x = -2.95, y = 0.14, z = -3.4) ----
    const srvMat = lam("dbi_srv", () => ({ color: "#2d89c8" }));
    const srvDark = lam("dbi_srvd", () => ({ color: "#23344d" }));
    const srvBody = new THREE.Mesh(boxGeo(V(-0.85, 0, -0.75), V(0.85, 2.55, 0.75)), srvMat);
    const srvVisor = new THREE.Mesh(boxGeo(V(-0.7, 1.75, -0.78), V(0.7, 2.25, 0.78)), srvDark);
    const srvSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshBasicMaterial({ map: stationLabel("srv", "SEARCH API", "#eef7ff", "#1a2840"), side: THREE.DoubleSide }));
    srvSign.position.set(0, 1.25, 0.79); srvSign.layers.set(NOINK);
    srvBody.castShadow = true;
    this.serverGrp.add(srvBody, srvVisor, srvSign);
    this.serverGrp.position.set(-2.95, 0.14, -3.4);
    R.add(this.serverGrp);

    // ---- Right Elevated Station: 1M-Row Table Rack (5 stacked row-drawer slabs) ----
    const dbDrawerMat = lam("dbi_db", () => ({ color: "#4f5d7a" }));
    const dbTargetMat = lam("dbi_dbt", () => ({ color: "#3d6a5c" }));
    const dbTrimMat = lam("dbi_dbr", () => ({ color: "#e5b84b" }));
    const lightGeo = new THREE.BoxGeometry(0.14, 0.16, 0.08);
    for (let k = 0; k < 5; k++) {
      const yBase = k * 0.54;
      const slab = new THREE.Mesh(boxGeo(V(-0.92, yBase, -0.82), V(0.92, yBase + 0.42, 0.82)), k === 3 ? dbTargetMat : dbDrawerMat);
      const band = new THREE.Mesh(boxGeo(V(-0.95, yBase + 0.42, -0.85), V(0.95, yBase + 0.50, 0.85)), dbTrimMat);
      slab.castShadow = band.castShadow = true;
      const bg = k === 3 ? "#fff8cc" : "#eef2f8";
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.34), new THREE.MeshBasicMaterial({ map: stationLabel("r" + k, ROW_LABELS[k], bg, "#241726", 32), side: THREE.DoubleSide }));
      lbl.position.set(-0.08, yBase + 0.21, 0.84); lbl.layers.set(NOINK);
      const ind = new THREE.Mesh(lightGeo, this.idleLightMat);
      ind.position.set(0.72, yBase + 0.21, 0.84); ind.layers.set(NOINK);
      this.rowLights.push(ind);
      this.dbGrp.add(slab, band, lbl, ind);
    }
    this.dbBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.30, 0), this.okBeaconMat);
    this.dbBeacon.position.set(0, 3.15, 0); this.dbBeacon.layers.set(NOINK);
    this.dbGrp.add(this.dbBeacon);
    this.dbGrp.position.set(2.75, 0.65, -3.4);
    R.add(this.dbGrp);

    // ---- Center Drop Station: 3D B-TREE INDEX PYRAMID (-0.1, 0.14, -3.4) ----
    const pedMat = lam("dbi_ped", () => ({ color: "#2bb673" }));
    const nodeMat = lam("dbi_node", () => ({ color: "#e5b84b" }));
    const strutMat = lam("dbi_strut", () => ({ color: "#241726" }));
    const ped = new THREE.Mesh(boxGeo(V(-0.96, 0, -0.78), V(0.96, 0.92, 0.78)), pedMat);
    ped.castShadow = true;
    const pedSign = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.56), new THREE.MeshBasicMaterial({ map: stationLabel("bt", "B-TREE INDEX", "#ffffff", "#147a49", 30), side: THREE.DoubleSide }));
    pedSign.position.set(0, 0.46, 0.80); pedSign.layers.set(NOINK);
    this.btreeGrp.add(ped, pedSign);

    const addStrut = (x0: number, y0: number, x1: number, y1: number) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, len, 0.08), strutMat);
      bar.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      bar.rotation.z = -Math.atan2(dx, dy);
      this.btreeGrp.add(bar);
    };

    // Connecting struts: Root (0, 2.65) -> Branch (-0.55, 1.95), (+0.55, 1.95) -> Leaves (-0.75, 0, +0.75 at y=1.25)
    addStrut(0, 2.65, -0.55, 1.95);
    addStrut(0, 2.65, 0.55, 1.95);
    addStrut(-0.55, 1.95, -0.75, 1.25);
    addStrut(-0.55, 1.95, 0, 1.25);
    addStrut(0.55, 1.95, 0, 1.25);
    addStrut(0.55, 1.95, 0.75, 1.25);

    const rootNode = new THREE.Mesh(boxGeo(V(-0.26, -0.18, -0.2), V(0.26, 0.18, 0.2)), nodeMat);
    rootNode.position.set(0, 2.65, 0); rootNode.castShadow = true;
    this.btreeGrp.add(rootNode);

    for (const bx of [-0.55, 0.55]) {
      const bn = new THREE.Mesh(boxGeo(V(-0.22, -0.15, -0.18), V(0.22, 0.15, 0.18)), nodeMat);
      bn.position.set(bx, 1.95, 0); bn.castShadow = true;
      this.btreeGrp.add(bn);
    }
    for (const lx of [-0.75, 0, 0.75]) {
      const ln = new THREE.Mesh(boxGeo(V(-0.2, -0.14, -0.16), V(0.2, 0.14, 0.16)), nodeMat);
      ln.position.set(lx, 1.25, 0); ln.castShadow = true;
      this.btreeGrp.add(ln);
    }

    this.btreeCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.hitMat);
    this.btreeCrystal.position.set(0, 3.22, 0); this.btreeCrystal.layers.set(NOINK);
    this.btreeGrp.add(this.btreeCrystal);
    this.btreeGrp.position.set(-0.1, 0.14, -3.4);
    R.add(this.btreeGrp);

    // ---- Pool of 12 Animated Query / Seek Orbs ----
    const pktGeo = new THREE.SphereGeometry(0.22, 12, 12);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(pktGeo, this.queryMat);
      m.layers.set(NOINK);
      m.visible = false;
      this.packets.push(m);
      R.add(m);
    }
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

    // ---- Database Rack Overload Shake / Crash & Row Indicator Lights ----
    const crashed = id === 5 && sim.s5Crash > 0.15;
    const stressed = (id === 5 && sim.s5Flood > 0.4) || (id === 1 && sim.s1Slow > 0.65);
    this.dbGrp.rotation.z = crashed ? -0.14 : stressed ? Math.sin(f * 0.9) * 0.032 : 0;
    this.dbGrp.position.y = crashed ? 0.48 : 0.65;
    this.dbBeacon.material = crashed || stressed ? this.crashMat : this.okBeaconMat;
    this.dbBeacon.position.y = 3.15 + Math.sin(f * 0.15) * 0.08;
    this.dbBeacon.rotation.y = f * 0.07;

    const scanIdx = id === 3 && f >= 875 ? Math.min(4, Math.floor(sim.s3Scan * 5)) : -1;
    for (let k = 0; k < 5; k++) {
      if (crashed) this.rowLights[k].material = this.crashMat;
      else if (id === 3 && k === scanIdx) this.rowLights[k].material = this.queryMat;
      else if (id >= 7 && sim.hit3ms > 0.4 && k === 3) this.rowLights[k].material = this.hitMat;
      else this.rowLights[k].material = this.idleLightMat;
    }

    // ---- B-Tree Index Drop (Shot 6+) & Crystal ----
    const hasBtree = id >= 6;
    this.btreeGrp.visible = hasBtree;
    if (hasBtree) {
      const dropU = id === 6 ? sim.btreeDrop : 1;
      const dropY = 0.14 + (1 - dropU) * 11.0;
      this.btreeGrp.position.set(-0.1, dropY, -3.4);
      this.btreeCrystal.visible = dropU > 0.85;
      this.btreeCrystal.position.y = 3.22 + Math.sin(f * 0.16) * 0.12;
      this.btreeCrystal.rotation.y = f * 0.09;
    }

    // ---- Animated Query / Scan / B-Tree Seek Orbs ----
    for (const p of this.packets) p.visible = false;
    if (id === 1) {
      const u = sim.s1Slow;
      const m = this.packets[0]; m.visible = true; m.material = this.queryMat;
      m.position.set(-2.2 + u * 4.5, 1.3 + Math.sin(u * Math.PI * 2) * 0.45, -2.9);
    } else if (id === 3) {
      const m = this.packets[0]; m.visible = true; m.material = this.queryMat;
      if (f < 875) {
        const u = (f - 650) / 225;
        m.position.set(-2.2 + u * 4.4, 1.35 + Math.sin(u * Math.PI) * 0.85, -2.9);
      } else {
        m.position.set(1.85, 0.85 + sim.s3Scan * 2.1, -2.3);
      }
    } else if (id === 5) {
      for (let i = 0; i < 12; i++) {
        const u = (f * 0.032 + i * 0.083) % 1;
        const m = this.packets[i]; m.visible = sim.s5Crash < 0.25;
        m.material = this.queryMat;
        m.position.set(-2.3 + u * 4.6, 1.35 + (i % 4) * 0.28 + Math.sin(u * Math.PI) * 0.9, -3.4 + ((i % 3) - 1) * 0.5);
      }
    } else if (id === 7) {
      const m = this.packets[0]; m.visible = true;
      if (sim.hit3ms > 0.05) {
        m.material = this.hitMat;
        m.position.set(2.2 - sim.hit3ms * 4.5, 2.35 - sim.hit3ms * 0.85 + Math.sin(sim.hit3ms * Math.PI) * 0.9, -2.9);
      } else {
        m.material = this.hitMat;
        const u = sim.btreeJump;
        // 3-step hop: API (-2.2, 1.5) -> Root (-0.1, 2.8) -> Leaf (+0.65, 1.4) -> ROW #742K (2.1, 2.4)
        if (u < 0.34) {
          const s1 = u / 0.34;
          m.position.set(-2.2 + s1 * 2.1, 1.5 + s1 * 1.3 + Math.sin(s1 * Math.PI) * 0.5, -2.9);
        } else if (u < 0.68) {
          const s2 = (u - 0.34) / 0.34;
          m.position.set(-0.1 + s2 * 0.75, 2.8 - s2 * 1.4 + Math.sin(s2 * Math.PI) * 0.4, -2.9);
        } else {
          const s3 = (u - 0.68) / 0.32;
          m.position.set(0.65 + s3 * 1.45, 1.4 + s3 * 1.0 + Math.sin(s3 * Math.PI) * 0.4, -2.7);
        }
      }
    } else if (id === 8) {
      const u = sim.writeUpdate;
      const m = this.packets[0]; m.visible = true; m.material = this.goldMat;
      m.position.set(-2.2 + u * 2.1, 1.4 + Math.sin(u * Math.PI) * 0.95 + u * 0.8, -2.9);
    } else if (id === 9) {
      for (let i = 0; i < 8; i++) {
        const u = (f * 0.042 + i * 0.125) % 1;
        const pingPong = u < 0.5 ? u * 2 : 2 - u * 2;
        const m = this.packets[i]; m.visible = true;
        m.material = u >= 0.5 ? this.hitMat : this.queryMat;
        m.position.set(-2.3 + pingPong * 1.9, 1.45 + (i % 3) * 0.25 + Math.sin(pingPong * Math.PI) * 0.6, -3.3 + ((i % 3) - 1) * 0.3);
      }
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
