// 30fps-ready 9-pose + 12-frame walk-cycle pixel-art Chibi cast with 16 sprite-matched facial expressions & 5 pixel-art FX overlays.
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { Pen } from "../paxsilica/toon";

import brownIdle from "./sprites/idle.png";
import brownWave from "./sprites/wave.png";
import brownPoint from "./sprites/point.png";
import brownThumbs from "./sprites/thumbs.png";
import brownCheer from "./sprites/cheer.png";
import brownWalk from "./sprites/walk.png";
import brownThink from "./sprites/think.png";
import brownSit from "./sprites/sit.png";
import brownPresent from "./sprites/present.png";

import bW00 from "./sprites/walk_00.png"; import bW01 from "./sprites/walk_01.png";
import bW02 from "./sprites/walk_02.png"; import bW03 from "./sprites/walk_03.png";
import bW04 from "./sprites/walk_04.png"; import bW05 from "./sprites/walk_05.png";
import bW06 from "./sprites/walk_06.png"; import bW07 from "./sprites/walk_07.png";
import bW08 from "./sprites/walk_08.png"; import bW09 from "./sprites/walk_09.png";
import bW10 from "./sprites/walk_10.png"; import bW11 from "./sprites/walk_11.png";

import blueIdle from "./sprites_alt/idle.png";
import blueWave from "./sprites_alt/wave.png";
import bluePoint from "./sprites_alt/point.png";
import blueThumbs from "./sprites_alt/thumbs.png";
import blueCheer from "./sprites_alt/cheer.png";
import blueWalk from "./sprites_alt/walk.png";
import blueThink from "./sprites_alt/think.png";
import blueSit from "./sprites_alt/sit.png";
import bluePresent from "./sprites_alt/present.png";

import uW00 from "./sprites_alt/walk_00.png"; import uW01 from "./sprites_alt/walk_01.png";
import uW02 from "./sprites_alt/walk_02.png"; import uW03 from "./sprites_alt/walk_03.png";
import uW04 from "./sprites_alt/walk_04.png"; import uW05 from "./sprites_alt/walk_05.png";
import uW06 from "./sprites_alt/walk_06.png"; import uW07 from "./sprites_alt/walk_07.png";
import uW08 from "./sprites_alt/walk_08.png"; import uW09 from "./sprites_alt/walk_09.png";
import uW10 from "./sprites_alt/walk_10.png"; import uW11 from "./sprites_alt/walk_11.png";

import faceNeutral from "./faces/neutral.png";
import faceBlink from "./faces/blink.png";
import faceSmile from "./faces/smile.png";
import faceWide from "./faces/wide.png";
import faceSideeye from "./faces/sideeye.png";
import faceAngry from "./faces/angry.png";
import faceWink from "./faces/wink.png";
import faceSad from "./faces/sad.png";
import faceTired from "./faces/tired.png";
import faceStarry from "./faces/starry.png";
import faceCalm from "./faces/calm.png";
import faceTalkA from "./faces/talk_a.png";
import faceTalkB from "./faces/talk_b.png";
import faceLaugh from "./faces/laugh.png";
import faceTalkO from "./faces/talk_o.png";
import faceGrimace from "./faces/grimace.png";

import fxSteam from "./fx/steam.png";
import fxSparkle from "./fx/sparkle.png";
import fxRing from "./fx/ring.png";
import fxQuestion from "./fx/question.png";
import fxQuestionR from "./fx/question_r.png";
import fxConfetti from "./fx/confetti.png";

export type ChibiPose = "idle" | "wave" | "point" | "thumbs" | "cheer" | "walk" | "think" | "sit" | "present";
export type ChibiFaceId =
  | "neutral" | "blink" | "smile" | "wide"
  | "sideeye" | "angry" | "wink" | "sad"
  | "tired" | "starry" | "calm" | "talk_a"
  | "talk_b" | "laugh" | "talk_o" | "grimace";
export type ChibiExpr = ChibiFaceId | "happy" | "shock" | "talk";
export type ChibiVariant = "brown" | "blue";
export type ChibiFxKind = "steam" | "sparkle" | "ring" | "question" | "confetti";

const STATIC_URLS: Record<ChibiVariant, Record<ChibiPose, string>> = {
  brown: {
    idle: brownIdle, wave: brownWave, point: brownPoint,
    thumbs: brownThumbs, cheer: brownCheer, walk: brownWalk,
    think: brownThink, sit: brownSit, present: brownPresent,
  },
  blue: {
    idle: blueIdle, wave: blueWave, point: bluePoint,
    thumbs: blueThumbs, cheer: blueCheer, walk: blueWalk,
    think: blueThink, sit: blueSit, present: bluePresent,
  },
};

const WALK_URLS: Record<ChibiVariant, string[]> = {
  brown: [bW00, bW01, bW02, bW03, bW04, bW05, bW06, bW07, bW08, bW09, bW10, bW11],
  blue: [uW00, uW01, uW02, uW03, uW04, uW05, uW06, uW07, uW08, uW09, uW10, uW11],
};

const FACE_URLS: Record<ChibiFaceId, string> = {
  neutral: faceNeutral, blink: faceBlink, smile: faceSmile, wide: faceWide,
  sideeye: faceSideeye, angry: faceAngry, wink: faceWink, sad: faceSad,
  tired: faceTired, starry: faceStarry, calm: faceCalm, talk_a: faceTalkA,
  talk_b: faceTalkB, laugh: faceLaugh, talk_o: faceTalkO, grimace: faceGrimace,
};

const FX_URLS: Record<ChibiFxKind, string> = {
  steam: fxSteam,
  sparkle: fxSparkle,
  ring: fxRing,
  question: fxQuestion,
  confetti: fxConfetti,
};

const IMGS: Partial<Record<string, HTMLImageElement>> = {};
let loadPromise: Promise<void> | null = null;

function regImg(key: string, src: string, tasks: Promise<void>[]) {
  const img = new Image();
  img.src = src;
  IMGS[key] = img;
  tasks.push(img.decode ? img.decode().catch(() => undefined) : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }));
}

export function ensureChibiLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  const tasks: Promise<void>[] = [];
  for (const variant of ["brown", "blue"] as ChibiVariant[]) {
    for (const pose of Object.keys(STATIC_URLS[variant]) as ChibiPose[]) {
      regImg(`${variant}:${pose}`, STATIC_URLS[variant][pose], tasks);
    }
    WALK_URLS[variant].forEach((url, i) => regImg(`${variant}:walk_${i}`, url, tasks));
  }
  for (const face of Object.keys(FACE_URLS) as ChibiFaceId[]) {
    regImg(`face:${face}`, FACE_URLS[face], tasks);
  }
  for (const fx of Object.keys(FX_URLS) as ChibiFxKind[]) {
    regImg(`fx:${fx}`, FX_URLS[fx], tasks);
  }
  regImg("fx:question_r", fxQuestionR, tasks);
  loadPromise = Promise.all(tasks).then(() => undefined);
  return loadPromise;
}

export function useChibiReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const handle = delayRender("Loading 30fps chibi sprite frames, faces & FX");
    ensureChibiLoaded().then(() => {
      if (alive) setReady(true);
      continueRender(handle);
    });
    return () => { alive = false; };
  }, []);
  return ready;
}

// Per-pose exact glasses-top anchor (cx, topRimY) & face patch scale in 420x480 sprite coordinates
const PATCH_W = 120;
const PATCH_H = 76;
const PATCH_TOP_PAD = 16;

const POSE_FACE_ANCHOR: Partial<Record<ChibiPose, { cx: number; topY: number; sx: number; sy: number }>> = {
  idle:    { cx: 211.5, topY: 158, sx: 0.985, sy: 0.96 },
  wave:    { cx: 234.5, topY: 159, sx: 0.975, sy: 0.96 },
  point:   { cx: 171.0, topY: 161, sx: 0.950, sy: 0.96 },
  thumbs:  { cx: 220.5, topY: 167, sx: 0.965, sy: 0.96 },
  cheer:   { cx: 210.0, topY: 160, sx: 0.980, sy: 0.96 },
  present: { cx: 168.5, topY: 135, sx: 0.985, sy: 0.96 },
  sit:     { cx: 207.5, topY: 165, sx: 0.945, sy: 0.95 },
};

const TALK_CYCLE: ChibiFaceId[] = ["smile", "talk_a", "talk_b", "talk_o", "talk_a", "laugh"];

export function resolveChibiFace(expr: ChibiExpr, f: number, seed: number): ChibiFaceId {
  const blink = ((f + seed * 19) % 72) < 4;
  if (blink && expr !== "shock" && expr !== "wide" && expr !== "starry" && expr !== "wink" && expr !== "blink") {
    return "blink";
  }
  if (expr === "talk") return TALK_CYCLE[Math.floor(f / 3) % TALK_CYCLE.length];
  if (expr === "happy") return ((f >> 4) + seed) % 3 === 0 ? "starry" : "laugh";
  if (expr === "shock") return (f % 8) < 4 ? "wide" : "talk_o";
  return expr;
}

export function drawChibi(
  p: Pen,
  pose: ChibiPose,
  variant: ChibiVariant = "brown",
  facing: -1 | 1 = 1,
  opts: { f?: number; expr?: ChibiExpr; seed?: number } = {}
) {
  const { f = 0, expr = "neutral", seed = 1 } = opts;
  const walkIdx = Math.floor(f * 0.75) % 12;
  const key = pose === "walk" ? `${variant}:walk_${walkIdx}` : `${variant}:${pose}`;
  const img = IMGS[key] ?? IMGS[`${variant}:${pose}`];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const g = p.g;
  const sc = 1.4;
  // Subtle 30fps breathing/bobbing squash-and-stretch anchored cleanly at sneaker soles y = 975
  const breath = pose === "walk" ? 1 : 1 + 0.014 * Math.sin(f * 0.18 + seed);
  const dx = 300 - (420 * sc) / 2;
  const dy = 975 - 480 * sc * breath + 14 * breath;

  g.save();
  g.imageSmoothingEnabled = false;
  if (facing === -1) {
    g.translate(300, 0);
    g.scale(-1, 1);
    g.translate(-300, 0);
  }
  g.translate(dx, dy);
  g.scale(sc, sc * breath);
  g.drawImage(img, 0, 0, 420, 480);

  const anchor = POSE_FACE_ANCHOR[pose];
  if (anchor) {
    const faceId = resolveChibiFace(expr, f, seed);
    const faceImg = IMGS[`face:${faceId}`];
    if (faceImg && faceImg.complete && faceImg.naturalWidth > 0) {
      const nw = PATCH_W * anchor.sx;
      const nh = PATCH_H * anchor.sy;
      const fx = anchor.cx - nw / 2;
      const fy = anchor.topY - PATCH_TOP_PAD * anchor.sy;
      g.drawImage(faceImg, fx, fy, nw, nh);
    }
  }
  g.restore();
}

export function drawChibiFx(
  p: Pen,
  kind: ChibiFxKind,
  cw: number,
  ch: number,
  opts: { f?: number; seed?: number; progress?: number; flipX?: boolean } = {}
) {
  const { f = 0, seed = 1, progress, flipX = false } = opts;
  const useRightQ = kind === "question" && flipX;
  const img = IMGS[useRightQ ? "fx:question_r" : `fx:${kind}`];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const g = p.g;
  const t = f / 30;
  g.save();
  g.imageSmoothingEnabled = false;

  let sx = 1;
  let sy = 1;
  let ox = 0;
  let oy = 0;

  if (kind === "steam") {
    const u = ((f + seed * 11) % 36) / 36;
    oy = (0.5 - u) * 14;
    ox = Math.sin(t * 5 + seed) * 5;
    sx = 0.92 + 0.08 * Math.sin(u * Math.PI);
    sy = sx;
  } else if (kind === "sparkle") {
    const pulse = 0.86 + 0.14 * Math.sin(t * 11 + seed);
    sx = pulse;
    sy = pulse;
  } else if (kind === "ring") {
    const u = progress !== undefined ? Math.min(1, Math.max(0, progress)) : ((f + seed * 7) % 24) / 24;
    sx = 0.45 + u * 0.55;
    sy = sx;
  } else if (kind === "question") {
    oy = Math.sin(t * 4.5 + seed) * 6;
    const pop = 0.95 + 0.05 * Math.sin(t * 7);
    sx = pop;
    sy = pop;
  } else if (kind === "confetti") {
    const u = progress !== undefined ? Math.min(1, Math.max(0, progress)) : ((f + seed * 5) % 30) / 30;
    sx = 0.85 + 0.15 * Math.sin(u * Math.PI * 0.8);
    sy = sx;
    oy = (u - 0.5) * 12;
  }

  const dw = cw * 0.84 * sx;
  const dh = ch * 0.84 * sy;
  if (flipX && !useRightQ) {
    g.translate(cw / 2 + ox, ch / 2 + oy);
    g.scale(-1, 1);
    g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    g.drawImage(img, (cw - dw) / 2 + ox, (ch - dh) / 2 + oy, dw, dh);
  }
  g.restore();
}
