export type LaneId = 'backlog' | 'queued' | 'done';
export type AudioMode = 'needs_vo' | 'vo_ready' | 'no_vo';
export type RigMode = 'stickman' | 'chibi';
export type CliEngine = 'agy' | 'claude' | 'codex' | 'opencode';
export type LogoConcept = 'cube' | 'clapper' | 'portal';

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
    return {
      ...card,
      audioMode: card.audioMode === 'no_vo' ? 'no_vo' : ('vo_ready' as const),
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

/** Generates an onboarding setup prompt for the user's chosen AI CLI agent. */
export function buildAiSetupPrompt(cliCmd: CliEngine, probes: EnvProbe[]): string {
  const missing = probes.filter((p) => !p.installed && p.id !== 'agy' && p.id !== 'claude' && p.id !== 'codex' && p.id !== 'opencode');
  const missingList = missing.length > 0 ? missing.map((m) => m.id).join(', ') : 'none missing (verify versions)';
  return [
    `[${cliCmd} setup] Prepare this ToonForge workspace for rendering vertical 2D-in-3D shorts:`,
    `1. Check required runtimes (git, node >=20, python >=3.10, ffmpeg, Chromium) and optional Rust/Cargo. Missing right now: ${missingList}. Install any missing tools for my OS.`,
    `2. Run \`npm ci\` in the repo root and \`npx remotion browser ensure\`.`,
    `3. Install Python audio/QA packages (\`python -m pip install numpy pillow\`) and verify \`python scripts/short_qa.py --help\`.`,
    `4. Confirm \`.toonforge/board.json\` is ready and summarize what was installed.`,
  ].join('\n');
}

/** Generates copyable terminal setup commands for manual onboarding. */
export function buildManualSetupCommands(probes: EnvProbe[]): string {
  const missingCargo = probes.some((p) => p.id === 'cargo' && !p.installed);
  const missingFfmpeg = probes.some((p) => p.id === 'ffmpeg' && !p.installed);
  const lines = [
    'git clone https://github.com/SilencioOrgs/toonforge-template.git && cd toonforge-template',
    'npm ci && npx remotion browser ensure',
    'python -m pip install numpy pillow',
  ];
  if (missingFfmpeg) lines.push('# Install FFmpeg first: winget install Gyan.FFmpeg  (or brew install ffmpeg)');
  if (missingCargo) lines.push('# Optional for native Tauri build: winget install Rustlang.Rustup');
  lines.push('ffmpeg -version && python scripts/short_qa.py --help');
  return lines.join('\n');
}
