import type { CardItem } from '../types/studio';

export type StepId = 'topic' | 'script' | 'voice' | 'scenes' | 'sound' | 'look' | 'render';
export type GuideId = 'intro' | 'howto' | 'requirements';
export type PageId = GuideId | StepId | 'library';

export interface PipelineStep {
  id: StepId;
  label: string;
  summary: string;
  output: string;
}

/** The claude-animated-shorts SKILL.md pipeline, grouped into the pages ToonForge shows. */
export const PIPELINE: PipelineStep[] = [
  { id: 'topic', label: 'Topic', summary: 'One surprising true story with a visual cause and effect, plus an everyday analogy that explains it.', output: '' },
  { id: 'script', label: 'Script', summary: '55 to 70 seconds of narration at about 3.7 words per second, with sound cues marked.', output: 'SCRIPT_<NAME>.md' },
  { id: 'voice', label: 'Voice', summary: 'Record or generate the narration, or skip it and make a music-only short.', output: 'voice/<name>_voice.wav' },
  { id: 'scenes', label: 'Scenes', summary: 'Your agent copies the bridge template, writes the shot plan, and builds the world, characters and post look.', output: 'src/videos/<name>/story.ts' },
  { id: 'sound', label: 'Sound', summary: 'Sound effects and music, mixed under the voice with ducking and loudness normalization.', output: 'audio/mix_<name>.wav' },
  { id: 'look', label: 'Look check', summary: 'Stills from key frames, so readability problems show up before the long render.', output: 'out/<name>/ stills' },
  { id: 'render', label: 'Render & QA', summary: 'The final 2K H.264 render, then frame and loudness checks.', output: 'out/<name>/<name>_2k.mp4' },
];

/** True when the workspace holds the artifact that step produces for this short. */
export function stepDone(card: CardItem | undefined, id: StepId): boolean {
  if (!card) return false;
  switch (id) {
    case 'topic':
      return true;
    case 'script':
      return Boolean(card.scriptFile);
    case 'voice':
      return Boolean(card.voiceFile) || card.audioMode === 'no_vo';
    case 'scenes':
      // No file proves the scene is finished; stills or a render mean it at least compiles.
      return Boolean(card.stills?.length || card.videoFile);
    case 'sound':
      return Boolean(card.mixWavFile);
    case 'look':
      return Boolean(card.stills?.length);
    case 'render':
      return Boolean(card.videoFile && card.qaReport);
  }
}

/** First pipeline step without its artifact; where "Continue" should go. */
export function nextStep(card: CardItem | undefined): StepId {
  return PIPELINE.find((s) => !stepDone(card, s.id))?.id ?? 'render';
}

/** The prompt each agent-driven step hands to the coding agent, worded after SKILL.md. */
export function stepPrompt(step: 'script' | 'words' | 'scenes' | 'sound' | 'look' | 'render', card: CardItem): string {
  const s = card.slug;
  const script = card.scriptFile ?? `SCRIPT_${s.toUpperCase()}.md`;
  const voice = card.audioMode === 'no_vo' ? null : card.voicePath ?? `voice/${s}_voice.wav`;
  const rig = card.rigMode === 'stickman' ? 'the built-in Stickman rig' : 'the Chibi sprites in src/videos/chibi/';
  switch (step) {
    case 'script':
      return `Use the cartoon short skill. Rewrite ${script} for "${card.title}" to the skill's beat formula: 55-70 s at about 3.7 words per second, hook first. Keep [SFX: ...] cues on their own lines.`;
    case 'words':
      return `Use the cartoon short skill, step 3. Make word timings for ${voice} as src/videos/${s}/words.json with any speech-to-text that gives word times.`;
    case 'scenes':
      return `Use the cartoon short skill, steps 4-7, for ${script}. Copy templates/bridge/ to src/videos/${s}/, write the shot plan in story.ts${voice ? ' timed to words.json' : ''}, build the world and characters with ${rig}, keep the post look (ink, lens blur, grade), register ${card.compositionId} in src/Root.tsx, then run npx tsc --noEmit.`;
    case 'sound':
      return `Use the cartoon short skill, step 8, for ${s}. Build the sound effects and music from story.ts and mix them ${voice ? `under ${voice} with ducking` : 'as a music-only track'}, loudness-normalized, to audio/mix_${s}.wav.`;
    case 'look':
      return `Use the cartoon short skill, step 9. Render look-check stills for ${card.compositionId} and list any readability problems with their frame numbers.`;
    case 'render':
      return `Use the cartoon short skill, steps 10-11. Render ${card.compositionId} at 2K to out/${s}/${s}_2k.mp4, run the frame and loudness QA, and report the results.`;
  }
}

/** Spoken-length estimate the skill uses (~3.7 words per second). */
export function estimateSeconds(text: string): number {
  const words = text.replace(/\[[^\]]*\]/g, ' ').replace(/^#.*$/gm, ' ').split(/\s+/).filter(Boolean).length;
  return Math.round(words / 3.7);
}
