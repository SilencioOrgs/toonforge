export type LaneId = 'backlog' | 'queued' | 'done';
export type AudioMode = 'needs_vo' | 'vo_ready' | 'no_vo';
export type RigMode = 'stickman' | 'chibi';
export type CliEngine = 'agy' | 'claude' | 'codex' | 'opencode';
export type LogoConcept = 'cube' | 'clapper' | 'portal';
export type VideoStep = 'script' | 'audio' | 'scene' | 'render';

export interface CardItem {
  id: string;
  slug: string;
  title: string;
  lane: LaneId;
  audioMode: AudioMode;
  rigMode: RigMode;
  durationLabel: string;
  compositionId: string;
  voiceFile?: string;
  scriptFile?: string;
  mixScript?: string;
  videoFile?: string;
  qaReport?: string;
  stills?: string[];
  loudness?: string;
  specs?: string;
}

export interface BoardState {
  version: number;
  autoQueue: boolean;
  activeLane: LaneId;
  selectedCardId: string;
  cards: CardItem[];
}

export interface EnvProbe {
  id: string;
  name: string;
  installed: boolean;
  version?: string;
  role?: string;
  installCmd?: string;
}

export interface EnvStatus {
  repoRoot: string;
  branch: string;
  probes: EnvProbe[];
}

export interface RigSummary {
  stickman: { ready: boolean; label: string };
  chibi: { ready: boolean; sprites: number; faces: number; fx: number };
}

export interface AiProviderGuide {
  id: CliEngine;
  title: string;
  accountReq: string;
  summary: string;
  installCmd: string;
  loginCmd: string;
}

export const AI_PROVIDER_GUIDES: Record<CliEngine, AiProviderGuide> = {
  agy: {
    id: 'agy',
    title: 'Antigravity AI CLI (Built-In Default)',
    accountReq: 'Built-in with Antigravity IDE (no separate API billing needed)',
    summary: 'Runs directly inside your workspace to write SCRIPT_*.md, Remotion scenes, and Python audio mixes.',
    installCmd: 'Bundled with Antigravity IDE (agy on PATH)',
    loginCmd: 'agy',
  },
  claude: {
    id: 'claude',
    title: 'Claude Code CLI',
    accountReq: 'Requires Claude Pro / Max account or Anthropic API key',
    summary: 'Anthropic coding agent in terminal; ideal if you already subscribe to Claude Pro/Max.',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    loginCmd: 'claude (sign in via browser on first run)',
  },
  codex: {
    id: 'codex',
    title: 'OpenAI Codex CLI',
    accountReq: 'Requires ChatGPT Plus / Pro account or OPENAI_API_KEY',
    summary: 'OpenAI terminal coding agent for editing Three.js scenes, storybeats, and captions.',
    installCmd: 'npm install -g @openai/codex',
    loginCmd: 'codex --login',
  },
  opencode: {
    id: 'opencode',
    title: 'OpenCode CLI',
    accountReq: 'Open-source BYOK (works with API keys or local Ollama models)',
    summary: 'Provider-agnostic open-source coding agent supporting Anthropic, Gemini, OpenRouter, or local models.',
    installCmd: 'npm install -g opencode-ai',
    loginCmd: 'opencode auth login',
  },
};

const AUDIO_CYCLE: Record<AudioMode, AudioMode> = {
  needs_vo: 'vo_ready',
  vo_ready: 'no_vo',
  no_vo: 'needs_vo',
};

const DURATION_BY_MODE: Record<AudioMode, string> = {
  needs_vo: 'Script Ready',
  vo_ready: 'VO Ready',
  no_vo: 'Visual Only',
};

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 18) || `short${Date.now()}`
  );
}

/** Cycles a card's audio mode and auto-queues ready cards from backlog when enabled. */
export function toggleCardAudioMode(board: BoardState, cardId: string): BoardState {
  let transitionedToQueued = false;

  const cards = board.cards.map((card) => {
    if (card.id !== cardId) return card;
    const nextMode = AUDIO_CYCLE[card.audioMode];
    const shouldQueue =
      board.autoQueue && card.lane === 'backlog' && (nextMode === 'vo_ready' || nextMode === 'no_vo');
    if (shouldQueue) transitionedToQueued = true;

    return {
      ...card,
      audioMode: nextMode,
      lane: shouldQueue ? ('queued' as const) : card.lane,
      durationLabel:
        nextMode === 'vo_ready' && card.voiceFile
          ? card.durationLabel.includes('VO')
            ? card.durationLabel
            : 'VO Ready'
          : DURATION_BY_MODE[nextMode],
    };
  });

  return {
    ...board,
    activeLane: transitionedToQueued ? 'queued' : board.activeLane,
    selectedCardId: transitionedToQueued ? cardId : board.selectedCardId,
    cards,
  };
}

/** Updates backlog cards whose voiceover file matches `<slug>_voice.(wav|mp3)`. */
export function applyVoiceFilesToBoard(board: BoardState, voiceFiles: string[]): BoardState {
  const normalized = voiceFiles.map((f) => f.toLowerCase());
  const cards = board.cards.map((card) => {
    const match = normalized.find((file) => file.startsWith(`${card.slug.toLowerCase()}_voice.`));
    if (!match) return card;

    const shouldQueue = board.autoQueue && card.lane === 'backlog';
    const nextAudioMode: AudioMode = card.audioMode === 'no_vo' ? 'no_vo' : 'vo_ready';
    return {
      ...card,
      audioMode: nextAudioMode,
      voiceFile: match,
      lane: shouldQueue ? ('queued' as const) : card.lane,
      durationLabel: card.durationLabel.includes('MP4') ? card.durationLabel : 'VO Synced',
    };
  });

  return { ...board, cards };
}

/** Prepends a new script card into the Backlog lane and selects it. */
export function addCardToBoard(board: BoardState, title: string, rigMode: RigMode): BoardState {
  const cleanTitle = title.trim() || `New Short #${board.cards.length + 1}`;
  const slug = slugifyTitle(cleanTitle);
  const id = `${slug}-${board.cards.length + 1}`;
  const card: CardItem = {
    id,
    slug,
    title: cleanTitle,
    lane: 'backlog',
    audioMode: 'needs_vo',
    rigMode,
    durationLabel: 'Script Draft',
    compositionId: `${slug[0].toUpperCase()}${slug.slice(1)}Short`,
  };
  return {
    ...board,
    activeLane: 'backlog',
    selectedCardId: id,
    cards: [card, ...board.cards],
  };
}

/** Assigns the selected character rig (`stickman` or `chibi`) on a card. */
export function setCardRig(board: BoardState, cardId: string, rigMode: RigMode): BoardState {
  return {
    ...board,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, rigMode } : card)),
  };
}

/** Generates an onboarding setup prompt specifically for the video creation stack. */
export function buildAiSetupPrompt(cliCmd: CliEngine, probes: EnvProbe[]): string {
  const missing = probes.filter(
    (p) => !p.installed && !['agy', 'claude', 'codex', 'opencode', 'cargo'].includes(p.id),
  );
  const missingList = missing.length > 0 ? missing.map((m) => m.id).join(', ') : 'none missing';
  return [
    `[${cliCmd} video-stack setup] Set up this repository to create 2D-in-3D vertical videos:`,
    `1. Verify required video tools: git, node (>=20 for Remotion 4), python (>=3.10 for audio DSP/QA), py_deps (numpy + pillow), ffmpeg/ffprobe, and Chromium. Missing: ${missingList}.`,
    `2. Install JS & Chromium deps: run \`npm ci\` and \`npx remotion browser ensure\`.`,
    `3. Install Python DSP & QA libs: run \`python -m pip install numpy pillow\` and confirm \`python scripts/short_qa.py --help\` works.`,
    `4. Verify \`src/Root.tsx\` typechecks (\`npm run typecheck\`) and summarize readiness to render.`,
  ].join('\n');
}

/** Generates copyable manual shell commands for setting up the video creation stack. */
export function buildManualSetupCommands(probes: EnvProbe[]): string {
  const missingFfmpeg = probes.some((p) => p.id === 'ffmpeg' && !p.installed);
  const missingPy = probes.some((p) => (p.id === 'python' || p.id === 'py_deps') && !p.installed);
  const lines = [
    '# 1. Clone repo & install Remotion + Three.js + React packages',
    'git clone https://github.com/SilencioOrgs/toonforge-template.git && cd toonforge-template',
    'npm ci && npx remotion browser ensure && npm run typecheck',
    '# 2. Install Python libs for -15 LUFS audio mastering & frame QA',
    'python -m pip install numpy pillow',
  ];
  if (missingFfmpeg) lines.push('# Install FFmpeg (required by audio/dsp.py & short_qa.py): winget install Gyan.FFmpeg');
  if (missingPy) lines.push('# Install Python 3.10+ if missing: winget install Python.Python.3.12');
  lines.push('# 3. Verify video render prerequisites', 'ffmpeg -version && python scripts/short_qa.py --help');
  return lines.join('\n');
}

/** Builds a clear, step-by-step AI CLI prompt tied directly to a card's files in the repo. */
export function buildVideoStepPrompt(step: VideoStep, card: CardItem, cli: CliEngine): string {
  const s = card.slug;
  const upper = s.toUpperCase();
  if (step === 'script') {
    return `[${cli}] Draft or refine SCRIPT_${upper}.md for "${card.title}": include a 2-second hook, ${card.audioMode === 'no_vo' ? 'visual-only beat cues (No-VO)' : 'VO narration beats with [TAG] SFX cues'}, and CTA ending.`;
  }
  if (step === 'audio') {
    return card.audioMode === 'no_vo'
      ? `[${cli}] Build beat timing in audio/mix_${s}.py using audio/suno_3.wav (visual-only No-VO mode, target -15 LUFS via audio/dsp.py).`
      : `[${cli}] Scan pauses in voice/${s}_voice.wav and build audio/mix_${s}.py using audio/dsp.py (duck Suno BGM behind VO, normalize to -15 LUFS).`;
  }
  if (step === 'scene') {
    return `[${cli}] Implement 3D stage & character animation in src/videos/${s}/ using the ${card.rigMode === 'stickman' ? 'procedural Stickman rig' : 'src/videos/chibi/sprite sheet (sprites/ + faces/ + fx/)'}, register ${card.compositionId} in src/Root.tsx, and run npm run typecheck.`;
  }
  return `[${cli}] Render 2K video for ${card.compositionId} (--crf 16 --scale 1.3333333333333333) to out/${s}/${s}_2k.mp4 and verify loudness & frames with python scripts/short_qa.py.`;
}
