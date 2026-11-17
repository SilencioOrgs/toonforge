// Hand-painted Canvas2D textures for the Tarlac / New Clark City / Aeta Pax Silica 3D world.
import * as THREE from "three";

export const rng = (seed: number) => {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

const cache = new Map<string, THREE.CanvasTexture>();
export const ctex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void) => {
  let t = cache.get(key);
  if (!t) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d")!, rng(key.length * 131 + key.charCodeAt(0) + key.charCodeAt(key.length - 1)));
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    cache.set(key, t);
  }
  return t;
};

export const rep = (t: THREE.Texture, x: number, y: number) => {
  const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c;
};

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length) % a.length];
const _jc = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };
export const jit = (r: () => number, hex: string, dv = 0.1, dh = 5, ds = 0.15) => {
  _jc.set(hex).getHSL(_hsl);
  const k = (a: number) => 1 + (r() * 2 - 1) * a;
  _jc.setHSL((_hsl.h + ((r() * 2 - 1) * dh) / 360 + 1) % 1, Math.min(1, _hsl.s * k(ds)), Math.min(0.95, _hsl.l * k(dv)));
  return "#" + _jc.getHexString();
};

const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const TAU = Math.PI * 2;
const wrap2 = (W: number, H: number, x: number, y: number, rad: number, fn: (x: number, y: number) => void) => {
  for (const ox of [0, -W, W]) for (const oy of [0, -H, H]) {
    const X = x + ox, Y = y + oy;
    if (X + rad > 0 && X - rad < W && Y + rad > 0 && Y - rad < H) fn(X, Y);
  }
};

export const grassHD = () => ctex("grassHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#69a84a"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 95; i++) {
    const x = U(r, 0, 1024), y = U(r, 0, 1024), rad = U(r, 28, 74);
    const col = r() > 0.5 ? "rgba(80,140,52,0.28)" : "rgba(130,192,82,0.26)";
    wrap2(1024, 1024, x, y, rad, (xx, yy) => {
      g.fillStyle = col; g.beginPath(); g.ellipse(xx, yy, rad * 1.4, rad * 0.85, 0.3, 0, TAU); g.fill();
    });
  }
  g.lineCap = "round";
  for (let i = 0; i < 2400; i++) {
    const x = U(r, 0, 1024), y = U(r, 0, 1024), l = U(r, 7, 15);
    g.strokeStyle = pick(r, ["#538d39", "#7ec157", "#629c44", "#8fd065"]); g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + U(r, -4, 4), y - l); g.stroke();
  }
});

export const soilPlotHD = () => ctex("soilPlotHD", 512, 512, (g, r) => {
  g.fillStyle = "#7a583b"; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    g.fillStyle = jit(r, "#684930", 0.1, 4, 0.1);
    g.fillRect(0, y + 6, 512, 52);
    g.fillStyle = "#3f2918";
    g.fillRect(0, y, 512, 6);
    g.fillStyle = "rgba(255,220,180,0.12)";
    g.fillRect(0, y + 6, 512, 4);
  }
});

export const asphaltHD = () => ctex("asphaltHD", 512, 512, (g, r) => {
  g.fillStyle = "#5b626c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 350; i++) {
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(25,28,34,0.14)";
    g.fillRect(r() * 512, r() * 512, 3 + r() * 6, 3 + r() * 6);
  }
  g.fillStyle = "#d9dce2"; g.fillRect(24, 0, 10, 512); g.fillRect(478, 0, 10, 512);
  g.fillStyle = "#e8c45a";
  for (let y = 16; y < 512; y += 96) g.fillRect(250, y, 12, 54);
});

export const cleanroomHD = () => ctex("cleanroomHD", 512, 512, (g, r) => {
  g.fillStyle = "#dfe6ee"; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 128 + 3, y = row * 128 + 3;
    g.fillStyle = jit(r, "#e6ecf3", 0.04, 2, 0.05);
    g.fillRect(x, y, 122, 122);
    g.fillStyle = "#9fb3c8"; g.fillRect(x, y + 118, 122, 4);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(x, y, 122, 3);
  }
  // sleek tinted cleanroom window band
  g.fillStyle = "#486b8a"; g.fillRect(0, 198, 512, 64);
  g.fillStyle = "#6ba8cc"; g.fillRect(0, 204, 512, 52);
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 28; x < 512; x += 128) {
    g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 30, 204); g.lineTo(x + 48, 204); g.lineTo(x + 18, 256); g.fill();
  }
});

export const bambooWallHD = () => ctex("bambooWallHD", 512, 512, (g, r) => {
  g.fillStyle = "#b98e54"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) {
    const x = i * 32;
    g.fillStyle = jit(r, "#c4985c", 0.08, 4, 0.1);
    g.fillRect(x + 2, 0, 28, 512);
    g.fillStyle = "#5c3d1e"; g.fillRect(x, 0, 3, 512);
    for (let y = (i % 2) * 64 + 32; y < 512; y += 128) {
      g.fillStyle = "#6e4c28"; g.fillRect(x + 2, y, 28, 5);
    }
  }
});

export const nipaThatchHD = () => ctex("nipaThatchHD", 512, 512, (g, r) => {
  g.fillStyle = "#8a6838"; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 12; row++) {
    const y = row * 44;
    g.fillStyle = "#4d351a"; g.fillRect(0, y + 36, 512, 7);
    for (let x = 0; x < 512; x += 18) {
      g.fillStyle = jit(r, "#a98249", 0.14, 5, 0.12);
      g.fillRect(x, y, 16, 38);
    }
  }
});

export const stoneHD = (key = "stoneHD", cols = ["#c9bcaa", "#bfb19f", "#d1c5b4", "#b8aa97"], mortar = "#8f8171") => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = mortar; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    let x = row % 2 ? -55 : 0;
    while (x < 512) {
      const w = 84 + r() * 68;
      g.fillStyle = jit(r, pick(r, cols), 0.1, 4, 0.12);
      g.fillRect(x + 3, row * 64 + 3, w - 6, 58);
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(x + 3, row * 64 + 3, w - 6, 6);
      x += w;
    }
  }
});

export const woodHD = () => ctex("woodHD", 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) {
    const y = i * 64;
    g.fillStyle = jit(r, "#b57e4a", 0.08, 4, 0.1);
    g.fillRect(0, y, 512, 64);
    g.fillStyle = "#3f2614"; g.fillRect(0, y, 512, 4);
  }
});

export const waferTex = () => ctex("waferTex", 512, 512, (g) => {
  g.fillStyle = "#193a5a"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#2b6e9e";
  for (let y = 20; y < 512; y += 36) for (let x = 20; x < 512; x += 36) {
    g.fillRect(x, y, 28, 28);
    g.fillStyle = "#62d0f5"; g.fillRect(x + 4, y + 4, 8, 8);
    g.fillStyle = "#2b6e9e";
  }
});

export const phFlagTex = () => ctex("phFlagTex", 512, 256, (g) => {
  g.fillStyle = "#0038a8"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#ce1126"; g.fillRect(0, 128, 512, 128);
  g.fillStyle = "#ffffff";
  g.beginPath(); g.moveTo(0, 0); g.lineTo(220, 128); g.lineTo(0, 256); g.closePath(); g.fill();
  g.fillStyle = "#fcd116";
  const sx = 82, sy = 128;
  g.beginPath(); g.arc(sx, sy, 22, 0, TAU); g.fill();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    g.save(); g.translate(sx, sy); g.rotate(a);
    g.beginPath(); g.moveTo(0, -40); g.lineTo(6, -18); g.lineTo(-6, -18); g.closePath(); g.fill();
    g.restore();
  }
  for (const [x, y] of [[24, 34], [24, 222], [186, 128]]) {
    g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
  }
});

export const waterMarks = (key: string, nCrest: number, nGlint: number) => ctex("waterMarks" + key, 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  for (let i = 0; i < nCrest; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), w = U(r, 18, 44), sag = w * U(r, 0.3, 0.45), lw = U(r, 3, 5), a = U(r, 0, Math.PI);
    wrap2(S, S, x, y, w, (xx, yy) => {
      g.save(); g.translate(xx, yy); g.rotate(a);
      const arc = (dy: number, col: string, k: number) => {
        g.strokeStyle = col; g.lineWidth = lw * k;
        g.beginPath(); g.moveTo(-w / 2, dy); g.quadraticCurveTo(0, dy - sag * 2, w / 2, dy); g.stroke();
      };
      arc(0, "rgb(255,0,0)", 1);
      arc(lw * 1.5, "rgb(0,255,0)", 0.9);
      g.restore();
    });
  }
  for (let i = 0; i < nGlint; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), len = U(r, 40, 140), lw = U(r, 1.2, 2.4), a = U(r, 0, Math.PI);
    wrap2(S, S, x, y, len, (xx, yy) => {
      g.save(); g.translate(xx, yy); g.rotate(a); g.strokeStyle = "rgb(0,0,255)"; g.lineWidth = lw;
      g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke(); g.restore();
    });
  }
  g.globalCompositeOperation = "source-over";
});
export const waterNear = () => waterMarks("near", 28, 5);
export const waterFar = () => waterMarks("far", 220, 30);

export const CLOUD_DAY = { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" };
export const cloudHD = (seed: number, pal = CLOUD_DAY) => ctex(`cloudHD_${pal.lit}_${seed}`, 1024, 512, (g) => {
  const r = rng(seed * 7919 + 17);
  const W = 1024, H = 512, base = 400;
  const n = 6 + Math.floor(r() * 4), lobes: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, rad = (60 + 110 * Math.sin(Math.PI * t) ** 0.8) * U(r, 0.75, 1.15);
    lobes.push({ x: 150 + t * 724 + U(r, -30, 30), y: base - rad * U(r, 0.35, 0.65), r: rad });
  }
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const t = U(r, 0.25, 0.75), rad = U(r, 60, 110);
    lobes.push({ x: 150 + t * 724, y: base - 150 - rad * U(r, 0.3, 0.7), r: rad });
  }
  const layer = (dx: number, dy: number, k: number, col: string, blur: number) => {
    g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col; g.beginPath();
    for (const l of lobes) { const x = l.x + dx * l.r, y = l.y + dy * l.r; g.moveTo(x + l.r * k, y); g.arc(x, y, l.r * k, 0, TAU); }
    g.fill(); g.restore();
  };
  layer(0, 0, 1.0, pal.shade, 6);
  layer(-0.04, -0.12, 0.9, pal.mid, 8);
  layer(-0.1, -0.26, 0.72, pal.lit, 10);
  g.globalCompositeOperation = "destination-in";
  const m = g.createLinearGradient(0, base - 18, 0, base + 6);
  m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = m; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
});
