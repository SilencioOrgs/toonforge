// "What If Pax Silica Is Approved?" (Philippines & Aeta Communities) - 60 s voiceless 2D-in-3D status short.
import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, interpolate, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, gradeFor } from "./grade";
import { dofAt, FLASH_AT, layersAt, shotAt, SHOTS, TOTAL } from "./story";

export const PAX_FRAMES = TOTAL;

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { gl, camera, scene, size } = useThree();
  const world = useMemo(() => new World(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const pipeline = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 4,
    });
    const renderPass = new RenderPass(scene, cam);
    const ink = new InkPass(scene, cam);
    const lens = new LensBlur({ maxCoC: 24, nearScale: 1.2 });
    const bloom = makeBloom();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const grade = new GradeEffect(GRADES.day, 1);

    composer.addPass(renderPass);
    composer.addPass(ink);
    composer.addPass(new EffectPass(cam, lens.pre));
    composer.addPass(new EffectPass(cam, lens.main));
    composer.addPass(new EffectPass(cam, bloom, tone, grade));
    composer.setSize(size.width, size.height);

    return { composer, ink, lens, grade };
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    pipeline.composer.setSize(size.width, size.height);
  }, [pipeline, size.width, size.height]);

  useEffect(() => () => {
    pipeline.composer.dispose();
    pipeline.ink.dispose();
    pipeline.lens.dispose();
  }, [pipeline]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);

  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  pipeline.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  pipeline.lens.cInf = d.cInf;
  gradeFor(pipeline.grade, SHOTS[id - 1].light);

  useFrame(() => {
    pipeline.composer.render();
  }, 1);

  return <primitive object={world.root} dispose={null} />;
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      {...(dprOverride() ? { dpr: dprOverride() } : {})}
      shadows
      gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}
    >
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

const StatusHud: React.FC<{ f: number }> = ({ f }) => {
  const s = shotAt(f);
  const age = f - s.a;
  const rem = s.b - f;
  const op = Math.min(interpolate(age, [0, 10], [0, 1], { extrapolateRight: "clamp" }), interpolate(rem, [0, 8], [0, 1], { extrapolateRight: "clamp" }));
  const y = interpolate(age, [0, 12], [-12, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 88,
        left: 48,
        right: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(24, 20, 32, 0.84)",
          border: `3px solid ${s.accent}`,
          borderRadius: 28,
          padding: "16px 32px",
          boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          textAlign: "center",
          maxWidth: 920,
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 2.2,
            color: s.accent,
            marginBottom: 6,
          }}
        >
          {s.badge}
        </div>
        <div
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            fontSize: 38,
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#fcfaf2",
          }}
        >
          {s.title}
        </div>
      </div>
    </div>
  );
};

export const PaxSilicaShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
      <StatusHud f={f} />
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
