// 3D world for "IDOR (Insecure Direct Object Reference)" synced to voice/idor_voice.wav.
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
  ctex("idor_sgn_" + key, 512, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = accent; g.fillRect(22, 22, 468, 66);
    g.fillStyle = "#ffffff"; g.font = "900 34px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(top, 256, 67, 440);
    g.fillStyle = "#241726"; g.font = "900 40px system-ui, sans-serif";
    g.fillText(sub, 256, 176, 440);
  });

const SEQ_IDS = ["#104", "#105", "#106"];
const UUID_IDS = ["a8f3-9c1e", "7d2b-4f09", "c19e-8b42"];

export class IdorWorld {
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

  private vaultDoors: THREE.Group[] = [];
  private seqPlaques: THREE.Mesh[] = [];
  private uuidPlaques: THREE.Mesh[] = [];
  private hotelDoors: THREE.Group[] = [];
  private ownerShield = new THREE.Group();
  private pktBolt: THREE.Mesh;
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

    // ---- Static Plazas (Main Server Plaza x=0, Hotel Lobby Plaza x=28) ----
    const b = new Batch();
    const grass = lam("i_grass", () => ({ map: rep(grassHD(), 32, 32) }));
    const plaza = lam("i_plaza", () => ({ map: rep(stoneHD("plaza", ["#d8d0c3", "#cbc2b4", "#e0d8cb", "#c2b9aa"], "#9b9183"), 6, 6) }));
    const hotelFloor = lam("i_hfloor", () => ({ map: rep(stoneHD("hfloor", ["#f2e6d0", "#e6d8bd", "#f8eedc", "#dacaa9"], "#b29c76"), 6, 6) }));
    const wallMat = lam("i_wall", () => ({ color: "#4e5a70" }));
    const hotelWallMat = lam("i_hwall", () => ({ color: "#8c3b38" }));
    const goldMat = lam("i_gold", () => ({ color: "#e5b84b" }));
    const wood = lam("i_wood", () => ({ map: woodHD() }));
    const gateMat = lam("i_gate", () => ({ color: "#2d89c8" }));
    const lockerMat = lam("i_lock", () => ({ color: "#3d485c" }));
    const parcelMat = lam("i_parcel", () => ({ color: "#e8b44c" }));
    const hillMat = lam("i_hill", () => ({ color: "#6c9e79" }));

    b.add(quad(V(-220, 0, 220), V(220, 0, 220), V(220, 0, -220), V(-220, 0, -220), 28, 28), grass);
    b.add(boxGeo(V(-8, 0, -12), V(8, 0.14, 5), 4), plaza);
    b.add(boxGeo(V(20, 0, -11), V(36, 0.14, 5), 4), hotelFloor);

    // Distant rounded backdrop hills
    for (let i = 0; i < 9; i++) {
      const m = new THREE.IcosahedronGeometry(30 + (i % 3) * 8, 2);
      m.scale(1.3, 0.65, 0.9);
      b.add(m, hillMat, new THREE.Matrix4().makeTranslation(-95 + i * 32, 3, -115 - (i % 2) * 18));
    }

    // Wide Auth Gate at z = -3.8 spanning x = -4.6..+4.6 so all 3 lockers remain visible through it
    for (const sx of [-4.5, 4.5]) b.add(boxGeo(V(sx - 0.25, 0.14, -4.05), V(sx + 0.25, 3.65, -3.55)), gateMat);
    b.add(boxGeo(V(-4.8, 3.45, -4.1), V(4.8, 3.9, -3.5)), gateMat);

    // Rear Orders Backdrop & 3 Order Vault Bodies at x = -3.0, 0, +3.0, z = -7.5
    b.add(boxGeo(V(-5.4, 0.14, -10.4), V(5.4, 8.2, -9.2), 2), wallMat);
    b.add(boxGeo(V(-5.6, 8.2, -10.5), V(5.6, 8.65, -9.1)), goldMat);
    const xs = [-3.0, 0, 3.0];
    for (const lx of xs) {
      // Back + sides + top/bottom leaving front cavity at z = -6.7 open for door reveal
      b.add(boxGeo(V(lx - 1.15, 0.14, -8.4), V(lx + 1.15, 3.35, -8.1)), lockerMat);
      b.add(boxGeo(V(lx - 1.15, 0.14, -8.4), V(lx - 0.9, 3.35, -6.7)), lockerMat);
      b.add(boxGeo(V(lx + 0.9, 0.14, -8.4), V(lx + 1.15, 3.35, -6.7)), lockerMat);
      b.add(boxGeo(V(lx - 1.15, 3.1, -8.4), V(lx + 1.15, 3.35, -6.7)), lockerMat);
      b.add(boxGeo(V(lx - 0.55, 0.25, -7.8), V(lx + 0.55, 1.35, -7.0)), parcelMat);
    }

    // Hotel Lobby backdrop & 3 Room Frames at x = 25, 28, 31, z = -5.5 (Shot 5)
    b.add(boxGeo(V(22.4, 0.14, -8.5), V(33.6, 5.8, -7.5), 2), hotelWallMat);
    b.add(boxGeo(V(22.2, 5.8, -8.6), V(33.8, 6.25, -7.4)), goldMat);
    for (const rx of [25.0, 28.0, 31.0]) {
      b.add(boxGeo(V(rx - 1.05, 0.14, -5.8), V(rx - 0.85, 3.1, -5.3)), wood);
      b.add(boxGeo(V(rx + 0.85, 0.14, -5.8), V(rx + 1.05, 3.1, -5.3)), wood);
      b.add(boxGeo(V(rx - 1.05, 2.95, -5.8), V(rx + 1.05, 3.25, -5.3)), goldMat);
      b.add(boxGeo(V(rx - 0.5, 0.2, -6.9), V(rx + 0.5, 1.1, -6.2)), parcelMat);
    }
    b.build(R);

    // Plaza Signs (all NOINK, cleanly separated vertically so rear never gets occluded)
    const gateSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.15),
      new THREE.MeshBasicMaterial({ map: signBoard("auth", "AUTH CHECK", "LOGGED IN? OK!", "#f0f9ff", "#2d89c8"), side: THREE.DoubleSide })
    );
    gateSign.position.set(0, 4.48, -3.75); gateSign.layers.set(NOINK);
    R.add(gateSign);

    const vaultSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.45),
      new THREE.MeshBasicMaterial({ map: signBoard("vault", "SERVER ORDERS", "DATABASE", "#eef4fa", "#2b6cb0"), side: THREE.DoubleSide })
    );
    vaultSign.position.set(0, 6.95, -9.15); vaultSign.layers.set(NOINK);
    R.add(vaultSign);

    const hotelSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.45),
      new THREE.MeshBasicMaterial({ map: signBoard("hotel", "HOTEL LOBBY", "ONE KEY FOR ALL?", "#fff8dc", "#c2323c"), side: THREE.DoubleSide })
    );
    hotelSign.position.set(28.0, 4.65, -7.45); hotelSign.layers.set(NOINK);
    R.add(hotelSign);

    // 3 Hinged Locker Doors with Sequential vs UUID Plaque Toggle
    const doorMat = lam("i_door", () => ({ color: "#68788c" }));
    const handleMat = lam("i_hndl", () => ({ color: "#e5b84b" }));
    for (let i = 0; i < 3; i++) {
      const piv = new THREE.Group();
      piv.position.set(xs[i] - 0.9, 0.14, -6.7);
      const panel = new THREE.Mesh(boxGeo(V(0, 0, -0.14), V(1.8, 2.9, 0.04)), doorMat);
      panel.castShadow = true;
      const handle = new THREE.Mesh(boxGeo(V(1.48, 1.15, 0.04), V(1.62, 1.65, 0.16)), handleMat);

      const seqPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.85),
        new THREE.MeshBasicMaterial({ map: signBoard("seq_" + i, "ORDER", SEQ_IDS[i], "#fffdf6", i === 1 ? "#e07a34" : "#2d89c8"), side: THREE.DoubleSide })
      );
      seqPlaque.position.set(0.9, 2.42, 0.08); seqPlaque.layers.set(NOINK);

      const uuidPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.88),
        new THREE.MeshBasicMaterial({ map: signBoard("uuid_" + i, "UUID", UUID_IDS[i], "#eef6ff", "#2bb673"), side: THREE.DoubleSide })
      );
      uuidPlaque.position.set(0.9, 2.42, 0.09); uuidPlaque.layers.set(NOINK);
      uuidPlaque.visible = false;

      piv.add(panel, handle, seqPlaque, uuidPlaque);
      R.add(piv);
      this.vaultDoors.push(piv);
      this.seqPlaques.push(seqPlaque);
      this.uuidPlaques.push(uuidPlaque);
    }

    // 3 Hinged Hotel Room Doors (x = 25, 28, 31)
    const hDoorMat = lam("i_hdoor", () => ({ map: woodHD() }));
    for (let i = 0; i < 3; i++) {
      const rx = 25.0 + i * 3.0;
      const piv = new THREE.Group();
      piv.position.set(rx - 0.85, 0.14, -5.5);
      const panel = new THREE.Mesh(boxGeo(V(0, 0, -0.1), V(1.7, 2.8, 0.05)), hDoorMat);
      panel.castShadow = true;
      const knob = new THREE.Mesh(boxGeo(V(1.45, 1.25, 0.05), V(1.58, 1.4, 0.16)), handleMat);
      const numPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.65),
        new THREE.MeshBasicMaterial({ map: signBoard("hrm_" + i, "HOTEL", "ROOM " + (104 + i), "#fffdf6", "#8c3b38"), side: THREE.DoubleSide })
      );
      numPlaque.position.set(0.85, 2.05, 0.08); numPlaque.layers.set(NOINK);
      piv.add(panel, knob, numPlaque);
      R.add(piv);
      this.hotelDoors.push(piv);
    }

    // Owner Check Shield (compact bar so locker UUID plaques stay visible above it in Shot 7)
    const shieldBar = new THREE.Mesh(boxGeo(V(-2.7, 0.16, -0.22), V(2.7, 1.55, 0.22)), lam("i_sh", () => ({ color: "#2bb673" })));
    shieldBar.castShadow = true;
    const shieldSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.1),
      new THREE.MeshBasicMaterial({ map: signBoard("owner", "OWNER CHECK", "AND user_id = ?", "#f0fff4", "#1b8a55"), side: THREE.DoubleSide })
    );
    shieldSign.position.set(0, 0.88, 0.25); shieldSign.layers.set(NOINK);
    this.ownerShield.add(shieldBar, shieldSign);
    this.ownerShield.position.set(0, 0, -3.45);
    R.add(this.ownerShield);

    // Glowing Request/Rejection Bolt
    this.pktBolt = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.5, 0.4) }));
    this.pktBolt.layers.set(NOINK);
    R.add(this.pktBolt);
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
    const hookVal = id <= 2 ? sim.hookOpen : 0;
    const opens = [
      Math.max(hookVal, id === 3 ? sim.aOpen104 : 0),
      Math.max(hookVal, id === 4 ? sim.bOpen105 : 0),
      hookVal,
    ];
    const showUuid = sim.uuidFlip > 0.5;
    for (let i = 0; i < 3; i++) {
      this.vaultDoors[i].rotation.y = -opens[i] * 1.65;
      this.seqPlaques[i].visible = !showUuid;
      this.uuidPlaques[i].visible = showUuid;
    }

    for (let i = 0; i < 3; i++) {
      this.hotelDoors[i].rotation.y = -sim.hotelOpen * 1.55;
    }

    this.ownerShield.visible = sim.ownerLock > 0.02;
    this.ownerShield.position.y = 5.6 * (1 - sim.ownerLock);

    // Attack/Rejection Bolt in Shot 6
    this.pktBolt.visible = id === 6 && f >= 1370 && f <= 1560;
    if (this.pktBolt.visible) {
      const u = Math.min(1, Math.max(0, (f - 1370) / 110));
      const z = u < 0.55 ? 0.5 - (u / 0.55) * 3.6 : -3.1 + ((u - 0.55) / 0.45) * 3.8;
      this.pktBolt.position.set(1.6, 1.1, z);
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
