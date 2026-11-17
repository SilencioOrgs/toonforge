// "Race Condition: Two People, Isang Seat" - 59.67 s 2D-in-3D short synced to voice/race_voice.wav (no captions).
import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { RaceWorld } from "./world";
import { InkPass, noInkFallback } from "../paxsilica/ink";
import { LensBlur } from "../paxsilica/lensblur";
import { GradeEffect, GRADES, gradeFor } from "../paxsilica/grade";
import { dofAt, FLASH_AT, layersAt, SHOTS, TOTAL } from "./story";

export const RACE_FRAMES = TOTAL;

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
  const world = useMemo(() => new RaceWorld(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const pipeline = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
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
  fpt.copy(target);
  pipeline.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  pipeline.lens.cInf = d.cInf;
  gradeFor(pipeline.grade, SHOTS[id - 1].light);

  useFrame(() => { pipeline.composer.render(); }, 1);
  return <primitive object={world.root} dispose={null} />;
};

const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows
      gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}
    >
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const RaceConditionShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
