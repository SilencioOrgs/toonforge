// 3D world for "SQL Injection (SQLi)" featuring Admin Vault, Query Concatenation Gate, Guard Post analogy (x=28), & Prepared Statement Shield.
import * as THREE from "three";
import { Batch, boxGeo, lam, quad, V } from "../paxsilica/build";
import { NOINK } from "../paxsilica/ink";
import { LIGHTS, LightPreset, LOOK } from "../paxsilica/lights";
import { cloudHD, ctex, grassHD, rep, stoneHD, woodHD } from "../paxsilica/paint";
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
  ctex("sq_sgn_" + key, 512, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = accent; g.fillRect(22, 22, 468, 66);
    g.fillStyle = "#ffffff"; g.font = "900 32px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(top, 256, 67, 440);
    g.fillStyle = "#241726"; g.font = "900 38px system-ui, sans-serif";
    g.fillText(sub, 256, 176, 440);
  });

export class SqliWorld {
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

  private adminDoor = new THREE.Group();
  private guardGate = new THREE.Group();
  private prepShield = new THREE.Group();
  private injectCube: THREE.Mesh;
  private concatCube: THREE.Mesh;
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
    const grass = lam("sq_grass", () => ({ map: rep(grassHD(), 32, 32) }));
    const plaza = lam("sq_plaza", () => ({ map: rep(stoneHD("sq_plaza", ["#d8d0c3", "#cbc2b4", "#e0d8cb", "#c2b9aa"], "#9b9183"), 6, 6) }));
    const guardFloor = lam("sq_gfloor", () => ({ map: rep(stoneHD("sq_gfl", ["#e8dfd0", "#dad0be", "#f2e8d9", "#cec2ae"], "#9a8f7b"), 6, 6) }));
    const vaultMat = lam("sq_vault", () => ({ color: "#4e5a70" }));
    const guardWallMat = lam("sq_gwall", () => ({ color: "#41577a" }));
    const goldMat = lam("sq_gold", () => ({ color: "#e5b84b" }));
    const gateMat = lam("sq_gate", () => ({ color: "#2d89c8" }));
    const wood = lam("sq_wood", () => ({ map: woodHD() }));
    const insideMat = lam("sq_in", () => ({ color: "#ffd56b" }));
    const hillMat = lam("sq_hill", () => ({ color: "#6c9e79" }));

    b.add(quad(V(-220, 0, 220), V(220, 0, 220), V(220, 0, -220), V(-220, 0, -220), 28, 28), grass);
    b.add(boxGeo(V(-7, 0, -11), V(7, 0.14, 5), 4), plaza);
    b.add(boxGeo(V(21, 0, -11), V(35, 0.14, 5), 4), guardFloor);

    for (let i = 0; i < 9; i++) {
      const m = new THREE.IcosahedronGeometry(30 + (i % 3) * 8, 2);
      m.scale(1.3, 0.65, 0.9);
      b.add(m, hillMat, new THREE.Matrix4().makeTranslation(-95 + i * 32, 3, -115 - (i % 2) * 18));
    }

    // Admin Vault Wall at z = -6.8 with Door Frame Opening [-1.4..+1.4]
    b.add(boxGeo(V(-4.6, 0.14, -7.8), V(-1.4, 7.6, -5.8), 2), vaultMat);
    b.add(boxGeo(V(1.4, 0.14, -7.8), V(4.6, 7.6, -5.8), 2), vaultMat);
    b.add(boxGeo(V(-1.4, 3.25, -7.8), V(1.4, 7.6, -5.8), 2), vaultMat);
    b.add(boxGeo(V(-4.6, 0.14, -8.5), V(4.6, 3.3, -8.1)), vaultMat);
    b.add(boxGeo(V(-4.8, 7.6, -7.9), V(4.8, 8.05, -5.7)), goldMat);
    b.add(boxGeo(V(-0.65, 0.25, -7.4), V(0.65, 1.45, -6.5)), insideMat);

    // Wide SQL Query Gate Arch at z = -3.2
    for (const sx of [-4.0, 4.0]) b.add(boxGeo(V(sx - 0.24, 0.14, -3.45), V(sx + 0.24, 3.65, -2.95)), gateMat);
    b.add(boxGeo(V(-4.3, 3.45, -3.5), V(4.3, 3.9, -2.9)), gateMat);

    // Guard Post Scene at x = 28 (Shot 5)
    b.add(boxGeo(V(23.5, 0.14, -7.8), V(26.5, 5.8, -6.4), 2), guardWallMat);
    b.add(boxGeo(V(29.5, 0.14, -7.8), V(32.5, 5.8, -6.4), 2), guardWallMat);
    b.add(boxGeo(V(26.5, 3.1, -7.8), V(29.5, 5.8, -6.4), 2), guardWallMat);
    b.add(boxGeo(V(23.3, 5.8, -7.9), V(32.7, 6.25, -6.3)), goldMat);
    b.add(boxGeo(V(27.2, 0.25, -7.6), V(28.8, 1.35, -6.9)), wood);
    b.build(R);

    const vaultSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 1.45),
      new THREE.MeshBasicMaterial({ map: signBoard("vault", "ADMIN DATABASE", "LOGIN VAULT", "#eef4fa", "#2b6cb0"), side: THREE.DoubleSide })
    );
    vaultSign.position.set(0, 6.25, -5.72); vaultSign.layers.set(NOINK);
    R.add(vaultSign);

    const gateSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.18),
      new THREE.MeshBasicMaterial({ map: signBoard("gate", "SQL QUERY", "SELECT * FROM users", "#fff5f5", "#c2323c"), side: THREE.DoubleSide })
    );
    gateSign.position.set(0, 4.48, -3.15); gateSign.layers.set(NOINK);
    R.add(gateSign);

    const guardSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.4),
      new THREE.MeshBasicMaterial({ map: signBoard("guard", "GUARD CHECK", "OBEYS PAPER SLIP?!", "#fff8dc", "#3566a8"), side: THREE.DoubleSide })
    );
    guardSign.position.set(28.0, 4.65, -6.32); guardSign.layers.set(NOINK);
    R.add(guardSign);

    // Hinged Admin Vault Door
    this.adminDoor.position.set(-1.35, 0.14, -5.8);
    const doorMesh = new THREE.Mesh(boxGeo(V(0, 0, -0.18), V(2.7, 3.08, 0.04)), lam("sq_door", () => ({ color: "#68788c" })));
    doorMesh.castShadow = true;
    const doorPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.8),
      new THREE.MeshBasicMaterial({ map: signBoard("admdr", "ADMIN", "NO PASSWORD?!", "#fffdf6", "#d94545"), side: THREE.DoubleSide })
    );
    doorPlate.position.set(1.35, 2.52, 0.06); doorPlate.layers.set(NOINK);
    this.adminDoor.add(doorMesh, doorPlate);
    R.add(this.adminDoor);

    // Hinged Guard Gate (Shot 5)
    this.guardGate.position.set(26.55, 0.14, -6.4);
    const gDoor = new THREE.Mesh(boxGeo(V(0, 0, -0.16), V(2.9, 2.9, 0.04)), wood);
    gDoor.castShadow = true;
    const gSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.78),
      new THREE.MeshBasicMaterial({ map: signBoard("gd", "ADMIN", "RESTRICTED", "#fffdf6", "#c2323c"), side: THREE.DoubleSide })
    );
    gSign.position.set(1.45, 2.15, 0.06); gSign.layers.set(NOINK);
    this.guardGate.add(gDoor, gSign);
    R.add(this.guardGate);

    // Heavy Green Prepared Statement Shield (clamps onto gate in Shot 6+)
    const shieldBar = new THREE.Mesh(boxGeo(V(-2.7, 0.16, -0.2), V(2.7, 1.55, 0.2)), lam("sq_sh", () => ({ color: "#2bb673" })));
    shieldBar.castShadow = true;
    const shieldSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.15),
      new THREE.MeshBasicMaterial({ map: signBoard("prep", "PREPARED STMT", "DATA(?) vs CODE", "#f0fff4", "#1b8a55"), side: THREE.DoubleSide })
    );
    shieldSign.position.set(0, 0.88, 0.23); shieldSign.layers.set(NOINK);
    this.prepShield.add(shieldBar, shieldSign);
    this.prepShield.position.set(0, 0, -2.75);
    R.add(this.prepShield);

    // Glowing red injected payload cube & blue SQL concat cube
    this.injectCube = new THREE.Mesh(boxGeo(V(-0.32, -0.32, -0.32), V(0.32, 0.32, 0.32)), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.45, 0.35) }));
    this.concatCube = new THREE.Mesh(boxGeo(V(-0.32, -0.32, -0.32), V(0.32, 0.32, 0.32)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.25, 2.4) }));
    this.injectCube.layers.set(NOINK); this.concatCube.layers.set(NOINK);
    R.add(this.injectCube, this.concatCube);
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

    // ---- Dynamic Animations ----
    const openVault = id <= 2 ? sim.vaultOpen : id === 4 ? sim.truePass : 0;
    this.adminDoor.rotation.y = -openVault * 1.5;
    this.guardGate.rotation.y = -sim.guardOpen * 1.5;

    this.prepShield.visible = sim.prepShield > 0.02;
    this.prepShield.position.y = 5.6 * (1 - sim.prepShield);

    // Packet trajectories (Shots 1, 3, 4, 7)
    this.injectCube.visible = id === 1 || id === 3 || id === 4 || id === 7;
    this.concatCube.visible = id === 3 || id === 6;
    if (id === 1) {
      this.injectCube.position.set(1.2 * (1 - sim.injectSlide), 1.0, 0.8 - sim.injectSlide * 6.0);
    } else if (id === 3) {
      this.concatCube.position.set(-1.3 * (1 - sim.concatWeld), 1.05, -0.5);
      this.injectCube.position.set(1.3 * (1 - sim.concatWeld), 1.05, -0.5);
    } else if (id === 4) {
      this.injectCube.position.set(0.8 * (1 - sim.truePass), 1.0, 0.8 - sim.truePass * 6.4);
    } else if (id === 6) {
      this.concatCube.position.set(-0.9, 1.05, -1.0);
    } else if (id === 7) {
      const u = sim.dataTrap;
      const z = u < 0.5 ? 0.6 - u * 6.0 : -2.4 + (u - 0.5) * 4.0;
      this.injectCube.position.set(1.1, 1.0, z);
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
