// Complete dynamic 3D world for the Tarlac / New Clark City / Aeta Pax Silica "What If" short.
import * as THREE from "three";
import { buildTarlacScene, boxGeo, lam, V } from "./build";
import { Actor, Fx, Pool, stage } from "./cast";
import { NOINK } from "./ink";
import { LIGHTS, LightPreset, LOOK } from "./lights";
import { cloudHD, phFlagTex, waferTex, waterFar, waterNear } from "./paint";
import { CHAR, LFB, TONE, twoTone, untone } from "./shade";
import { camAt, clamp01, FPS, SHOTS, ShotDef, simAt, smooth, V3 } from "./story";

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

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite;
  private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];

  // Dynamic story props
  private zoneOutline: THREE.Mesh;
  private corridorGlow: THREE.Mesh;
  private fabGroup = new THREE.Group();
  private trucks: THREE.Mesh[] = [];
  private barInvest: THREE.Mesh;
  private barJobs: THREE.Mesh;
  private fenceGroup = new THREE.Group();
  private waterCol: THREE.Mesh;
  private cleanPipe: THREE.Mesh;
  private shieldGroup = new THREE.Group();
  private phFlag: THREE.Mesh;
  private scaleGroup = new THREE.Group();
  private scaleBeam: THREE.Mesh;
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

    const { cleanroomMat } = buildTarlacScene(R);

    // Dividing stream (x = 4..8)
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "river_tarlac";
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 480).rotateX(-Math.PI / 2), waterM);
    stream.position.set(6, -0.25, 0); stream.receiveShadow = true;
    R.add(stream);

    // 4,000-acre Economic Security Zone glowing footprint & Luzon corridor glow
    this.zoneOutline = new THREE.Mesh(
      new THREE.RingGeometry(16, 17.5, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 1.1), side: THREE.DoubleSide })
    );
    this.zoneOutline.position.set(-12, 0.08, -4);
    this.zoneOutline.layers.set(NOINK);
    R.add(this.zoneOutline);

    this.corridorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 200).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.9, 1.3), transparent: true, opacity: 0.7 })
    );
    this.corridorGlow.position.set(-22, 0.06, 0);
    this.corridorGlow.layers.set(NOINK);
    R.add(this.corridorGlow);

    // Cleanroom Fab Domes + Wafer Towers (rise on approval)
    const accentTeal = lam("accentTeal", () => ({ color: "#2d9ca8" }));
    const waferMat = lam("wafer", () => ({ map: waferTex() }));
    const fabSpecs: [number, number, number, number, number][] = [
      [-14, -8, 12, 7.5, 10], [-14, 2, 9, 5.2, 7], [-5, -12, 8, 4.8, 8],
    ];
    for (const [fx, fz, fw, fh, fd] of fabSpecs) {
      const m = new THREE.Mesh(boxGeo(V(-fw / 2, 0, -fd / 2), V(fw / 2, fh, fd / 2), 4), cleanroomMat);
      m.position.set(fx, 0, fz); m.castShadow = true; m.receiveShadow = true;
      const cap = new THREE.Mesh(boxGeo(V(-fw / 2 - 0.3, fh, -fd / 2 - 0.3), V(fw / 2 + 0.3, fh + 0.6, fd / 2 + 0.3)), accentTeal);
      cap.position.set(fx, 0, fz); cap.castShadow = true;
      this.fabGroup.add(m, cap);
    }
    const waferDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 24), waferMat);
    waferDisc.position.set(-14, 8.2, -8); waferDisc.castShadow = true;
    this.fabGroup.add(waferDisc);
    R.add(this.fabGroup);

    // Shuttle trucks along corridor highway
    const truckMat = lam("truck", () => ({ color: "#f0ece1" }));
    const cabMat = lam("cab", () => ({ color: "#2bb673" }));
    for (let i = 0; i < 4; i++) {
      const tMesh = new THREE.Mesh(boxGeo(V(-0.9, 0.3, -2.0), V(0.9, 1.8, 2.0)), truckMat);
      const cab = new THREE.Mesh(boxGeo(V(-0.85, 0.3, -3.1), V(0.85, 1.5, -2.05)), cabMat);
      tMesh.add(cab); tMesh.castShadow = true;
      tMesh.position.set(i % 2 ? -20.5 : -23.5, 0, -60 + i * 38);
      this.trucks.push(tMesh); R.add(tMesh);
    }

    // Economic upside 3D meter columns (Investment & Jobs) in clear view beside cleanrooms
    const barMatA = twoTone(new THREE.MeshLambertMaterial({ color: "#2bb673" }));
    const barMatB = twoTone(new THREE.MeshLambertMaterial({ color: "#2d89c8" }));
    this.barInvest = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4).translate(0, 0.5, 0), barMatA);
    this.barJobs = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4).translate(0, 0.5, 0), barMatB);
    this.barInvest.position.set(-4.5, 0, -2.0); this.barJobs.position.set(-1.2, 0, -2.0);
    this.barInvest.castShadow = this.barJobs.castShadow = true;
    R.add(this.barInvest, this.barJobs);

    // Construction perimeter fence (pushes toward Aeta village in Shots 6-7, pulls back in Shot 8)
    const fenceMat = lam("fence", () => ({ color: "#e88835" }));
    const postMat = lam("fpost", () => ({ color: "#4d4b52" }));
    for (let z = -14; z <= 14; z += 4) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18).translate(0, 0.8, 0), postMat);
      p.position.set(0, 0, z); p.castShadow = true;
      this.fenceGroup.add(p);
      if (z < 14) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 3.9), fenceMat);
        rail.position.set(0, 1.0, z + 2); rail.castShadow = true;
        this.fenceGroup.add(rail);
      }
    }
    R.add(this.fenceGroup);

    // Aeta community water tower + open-cage animated water level gauge (x = 18.8, z = -6.2)
    const ringBot = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.25, 16), lam("tank", () => ({ color: "#687380" })));
    ringBot.position.set(18.8, 1.35, -6.2); ringBot.castShadow = true;
    const ringTop = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.25, 16), lam("tankTop", () => ({ color: "#687380" })));
    ringTop.position.set(18.8, 4.15, -6.2); ringTop.castShadow = true;
    for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.1, 0.16), postMat);
      leg.position.set(18.8 + lx, 2.05, -6.2 + lz); leg.castShadow = true; R.add(leg);
    }
    this.waterCol = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 2.6, 16).translate(0, 1.3, 0), new THREE.MeshBasicMaterial({ color: "#35b0eb" }));
    this.waterCol.position.set(18.8, 1.4, -6.2); this.waterCol.layers.set(NOINK);
    R.add(ringBot, ringTop, this.waterCol);

    // Closed-loop clean-tech water recycling pipe inside industrial zone (Shots 9-10)
    this.cleanPipe = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.32, 10, 28).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.2) })
    );
    this.cleanPipe.position.set(-7.5, 1.2, 4.2); this.cleanPipe.layers.set(NOINK);
    R.add(this.cleanPipe);

    // Official Safeguards: Green Buildable-Zone buffer wall + Philippine Flag (Shots 8-10)
    const bufWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 28), new THREE.MeshBasicMaterial({ color: "#2bb673", transparent: true, opacity: 0.75 }));
    bufWall.position.set(3.2, 0.9, 0); bufWall.layers.set(NOINK);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 8), postMat);
    pole.position.set(3.2, 2.6, -4.5); pole.castShadow = true;
    this.phFlag = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05, 8, 1), lam("phFlag", () => ({ map: phFlagTex(), side: THREE.DoubleSide })));
    this.phFlag.position.set(4.25, 4.5, -4.5); this.phFlag.castShadow = true;
    this.shieldGroup.add(bufWall, pole, this.phFlag);
    R.add(this.shieldGroup);

    // Shot 10 Finale Balance Scale hovering above the dividing stream
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6.5, 10), lam("gold", () => ({ color: "#e5b84b" })));
    pillar.position.set(0, 3.25, 0);
    this.scaleBeam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.32, 0.32), lam("gold2", () => ({ color: "#f2ca5c" })));
    this.scaleBeam.position.set(0, 6.5, 0);
    const panL = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.0, 0.4, 14), lam("panL", () => ({ color: "#2bb673" })));
    panL.position.set(-4.8, -1.6, 0);
    const panR = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.0, 0.4, 14), lam("panR", () => ({ color: "#d97336" })));
    panR.position.set(4.8, -1.6, 0);
    this.scaleBeam.add(panL, panR);
    this.scaleGroup.add(pillar, this.scaleBeam);
    this.scaleGroup.position.set(6, 0.4, 0);
    R.add(this.scaleGroup);
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

    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;

    // ---- dynamic story beats ----
    this.zoneOutline.visible = sim.approved > 0.02;
    this.zoneOutline.scale.setScalar(0.4 + 0.6 * sim.approved);
    this.corridorGlow.visible = sim.approved > 0.05;
    (this.corridorGlow.material as THREE.MeshBasicMaterial).opacity = 0.65 * sim.approved;

    this.fabGroup.visible = sim.fabs > 0.01;
    this.fabGroup.scale.set(1, Math.max(0.01, sim.fabs), 1);

    this.trucks.forEach((tr, i) => {
      tr.visible = sim.approved > 0.2;
      const dir = i % 2 === 0 ? 1 : -1;
      tr.position.z = ((t * 14 * dir + i * 45 + 180) % 160) - 80;
    });

    this.barInvest.visible = this.barJobs.visible = sim.meters > 0.02;
    this.barInvest.scale.set(1, Math.max(0.1, sim.meters * 11), 1);
    this.barJobs.scale.set(1, Math.max(0.1, sim.meters * 14.5), 1);

    // Fence pushes across x = 2 -> 12.2 during Shots 6-7, pulls back to x = 4.6 under safeguards
    this.fenceGroup.visible = id >= 3;
    this.fenceGroup.position.x = 1.8 + sim.fencePush * 10.4;

    // Community water gauge level
    this.waterCol.scale.set(1, clamp01(sim.waterLvl), 1);
    (this.waterCol.material as THREE.MeshBasicMaterial).color.set(sim.waterLvl < 0.55 ? "#e88835" : "#35b0eb");

    this.cleanPipe.visible = sim.cleanLoop > 0.02;
    this.cleanPipe.scale.setScalar(0.2 + 0.8 * sim.cleanLoop);

    this.shieldGroup.visible = sim.safeguard > 0.02;
    this.shieldGroup.position.y = -2.2 * (1 - sim.safeguard);
    const p = this.phFlag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = (i % 9) / 8;
      p.setZ(i, 0.16 * u * Math.sin(t * 5 - u * 4));
    }
    p.needsUpdate = true;

    this.scaleGroup.visible = id === 10;
    this.scaleBeam.rotation.z = sim.scaleTilt;

    // ---- cast + effects ----
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
      a.mesh.scale.set(pl.mirror ? -sc2 : sc2, sc2, sc2);
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

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.0, 0.35 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
