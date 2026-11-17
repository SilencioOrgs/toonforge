// 3D world for "Race Condition: Two People, Isang Seat" (VIP Seat #A1 + Check/Save Gates + Database Vault).
import * as THREE from "three";
import { Batch, boxGeo, lam, quad, V } from "../paxsilica/build";
import { NOINK } from "../paxsilica/ink";
import { LIGHTS, LightPreset, LOOK } from "../paxsilica/lights";
import { cloudHD, ctex, grassHD, rep, stoneHD, woodHD } from "../paxsilica/paint";
import { CHAR, TONE, twoTone, untone } from "../paxsilica/shade";
import { Actor, Fx, Pool, stage } from "./cast";
import { camAt, FPS, SHOTS, ShotDef, simAt } from "./story";

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
  ctex("sign2_" + key, 512, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = accent; g.fillRect(22, 22, 468, 64);
    g.fillStyle = "#ffffff"; g.font = "900 34px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(top, 256, 66, 440);
    g.fillStyle = "#241726"; g.font = "900 40px system-ui, sans-serif";
    g.fillText(sub, 256, 174, 440);
  });

export class RaceWorld {
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

  private checkGate = new THREE.Group();
  private saveGate = new THREE.Group();
  private atomicBanner: THREE.Mesh;
  private lockShield = new THREE.Group();
  private pktA: THREE.Mesh;
  private pktB: THREE.Mesh;
  private seatBadge: THREE.Mesh;
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

    // ---- static plaza, stage, theater backdrop, rails & Database Vault ----
    const b = new Batch();
    const grass = lam("r_grass", () => ({ map: rep(grassHD(), 32, 32) }));
    const plaza = lam("r_plaza", () => ({ map: rep(stoneHD("plaza", ["#d8d0c3", "#cbc2b4", "#e0d8cb", "#c2b9aa"], "#9b9183"), 6, 6) }));
    const velvet = lam("r_velvet", () => ({ color: "#c2323c" }));
    const gold = lam("r_gold", () => ({ color: "#e5b84b" }));
    const wood = lam("r_wood", () => ({ map: woodHD() }));
    const vaultMat = lam("r_vault", () => ({ color: "#4e5a70" }));
    const railMat = lam("r_rail", () => ({ color: "#68788c" }));
    const hillMat = lam("r_hill", () => ({ color: "#6c9e79" }));

    b.add(quad(V(-200, 0, 200), V(200, 0, 200), V(200, 0, -200), V(-200, 0, -200), 25, 25), grass);
    b.add(boxGeo(V(-8, 0, -14), V(8, 0.14, 5), 4), plaza);

    // Distant rounded backdrop hills
    for (let i = 0; i < 7; i++) {
      const m = new THREE.IcosahedronGeometry(30 + (i % 3) * 8, 2);
      m.scale(1.3, 0.65, 0.9);
      b.add(m, hillMat, new THREE.Matrix4().makeTranslation(-95 + i * 32, 3, -110 - (i % 2) * 18));
    }

    // Raised stage + single VIP Seat #A1 at (0, 0.4, 0)
    const stageCyl = new THREE.CylinderGeometry(1.8, 2.0, 0.42, 24);
    b.add(stageCyl, wood, new THREE.Matrix4().makeTranslation(0, 0.21, 0));
    b.add(boxGeo(V(-0.68, 0.42, -0.55), V(0.68, 0.92, 0.55)), velvet); // cushion
    b.add(boxGeo(V(-0.68, 0.92, -0.55), V(0.68, 2.1, -0.25)), velvet); // backrest
    for (const sx of [-0.74, 0.56]) b.add(boxGeo(V(sx, 0.42, -0.45), V(sx + 0.18, 1.25, 0.45)), gold); // armrests

    // Two parallel conveyor tracks (x = -0.9 and +0.9, z = -1 -> -9.5)
    for (const tx of [-0.9, 0.9]) b.add(boxGeo(V(tx - 0.18, 0.14, -9.8), V(tx + 0.18, 0.24, -1.2)), railMat);

    // Database Vault at z = -10.5 (tall enough for clear DATABASE sign above gates)
    b.add(boxGeo(V(-3.4, 0.14, -13.2), V(3.4, 6.2, -9.8), 2), vaultMat);
    b.add(boxGeo(V(-3.6, 6.2, -13.4), V(3.6, 6.7, -9.6)), gold);
    b.build(R);

    // Unlit Seat #A1 sign on backrest & DATABASE sign on vault
    this.seatBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.6),
      new THREE.MeshBasicMaterial({ map: signBoard("a1", "VIP SEAT", "#A1", "#fcf5e3", "#c2323c") })
    );
    this.seatBadge.position.set(0, 2.48, -0.25); this.seatBadge.layers.set(NOINK);
    R.add(this.seatBadge);

    const dbSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.4),
      new THREE.MeshBasicMaterial({ map: signBoard("db", "POSTGRES / SQL", "DATABASE", "#eef4fa", "#2b6cb0") })
    );
    dbSign.position.set(0, 5.05, -9.75); dbSign.layers.set(NOINK);
    R.add(dbSign);

    // Step 1: CHECK Gate & Step 2: SAVE Gate (start separated, merge into 1 atomic gate in Shot 5)
    const arch = (col: string, title: string, sub: string) => {
      const g = new THREE.Group();
      const mat = lam("g_" + title, () => ({ color: col }));
      for (const sx of [-2.0, 2.0]) {
        const p = new THREE.Mesh(boxGeo(V(sx - 0.22, 0.14, -0.22), V(sx + 0.22, 2.8, 0.22)), mat);
        p.castShadow = true; g.add(p);
      }
      const top = new THREE.Mesh(boxGeo(V(-2.25, 2.5, -0.25), V(2.25, 3.2, 0.25)), mat);
      top.castShadow = true; g.add(top);
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.15), new THREE.MeshBasicMaterial({ map: signBoard(title, title, sub, "#fffdf6", col), side: THREE.DoubleSide }));
      sgn.position.set(0, 3.85, 0); sgn.layers.set(NOINK); g.add(sgn);
      return g;
    };
    this.checkGate = arch("#e88835", "STEP 1", "CHECK");
    this.saveGate = arch("#2d89c8", "STEP 2", "SAVE");
    this.checkGate.position.set(0, 0, -4.0);
    this.saveGate.position.set(0, 0, -7.2);
    R.add(this.checkGate, this.saveGate);

    this.atomicBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.45),
      new THREE.MeshBasicMaterial({ map: signBoard("atomic", "1 ATOMIC STEP", "UPDATE IF OK", "#f0fff4", "#2bb673"), side: THREE.DoubleSide })
    );
    this.atomicBanner.position.set(0, 3.15, -5.6); this.atomicBanner.layers.set(NOINK);
    R.add(this.atomicBanner);

    // Unique Constraint Lock Shield (Shot 7-8)
    const shieldBody = new THREE.Mesh(boxGeo(V(-2.4, 0.2, -0.25), V(2.4, 2.5, 0.25)), lam("sh", () => ({ color: "#e5b84b" })));
    shieldBody.castShadow = true;
    const shieldSign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.25), new THREE.MeshBasicMaterial({ map: signBoard("uniq", "EXTRA LOCK", "UNIQUE(SEAT)", "#fffdf2", "#c88a22"), side: THREE.DoubleSide }));
    shieldSign.position.set(0, 1.4, 0.28); shieldSign.layers.set(NOINK);
    this.lockShield.add(shieldBody, shieldSign);
    this.lockShield.position.set(0, 0, -9.2);
    R.add(this.lockShield);

    // Two glowing racing booking packets (Blue A & Orange B)
    this.pktA = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 2.4) }));
    this.pktB = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.2) }));
    this.pktA.layers.set(NOINK); this.pktB.layers.set(NOINK);
    R.add(this.pktA, this.pktB);
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
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], sim = simAt(f);
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

    // ---- dynamic animation ----
    this.checkGate.position.z = -3.6 - 1.9 * sim.atomicMerge;
    this.saveGate.position.z = -7.6 + 1.9 * sim.atomicMerge;
    this.atomicBanner.visible = sim.atomicMerge > 0.7 && id < 7;
    this.checkGate.visible = this.saveGate.visible = sim.atomicMerge < 0.75;

    this.lockShield.visible = sim.uniqueLock > 0.02;
    this.lockShield.position.y = 6.0 * (1 - sim.uniqueLock);

    // Packet trajectories
    this.pktA.visible = this.pktB.visible = id >= 3 && id <= 7;
    if (id === 3) {
      const u = ((f - 336) / 180) % 1;
      this.pktA.position.set(-0.9, 0.55, -1.2 - u * 8.2);
      this.pktB.visible = false;
    } else if (id === 4) {
      const u = Math.min(1, (f - 548) / 90);
      this.pktA.position.set(-0.9, 0.55, -1.2 - u * 8.4);
      this.pktB.position.set(0.9, 0.55, -1.2 - u * 8.4);
    } else if (id === 5 || id === 6) {
      const uA = Math.min(1, (f - 760) / 140);
      const uB = Math.min(1, Math.max(0, (f - 820) / 140));
      this.pktA.position.set(-0.9, 0.55, -1.2 - uA * 8.4);
      const zB = uB < 0.55 ? -1.2 - uB * 8.4 : -5.8 + (uB - 0.55) * 6.0;
      this.pktB.position.set(0.9, 0.55, zB);
    } else if (id === 7) {
      const u = Math.min(1, Math.max(0, (f - 1260) / 65));
      this.pktA.visible = false;
      const zB = u < 0.75 ? -1.2 - u * 10.5 : -9.0 + (u - 0.75) * 14.0;
      this.pktB.position.set(0.9, 0.55, zB);
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
