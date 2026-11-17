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
  voicePath?: string;
  scriptFile?: string;
  mixScript?: string;
  mixWavFile?: string;
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
  chibi: {
    ready: boolean;
    sprites: number;
    faces: number;
    fx: number;
    spriteFiles?: string[];
    faceFiles?: string[];
    fxFiles?: string[];
  };
}

export interface ScriptDoc {
  slug: string;
  file: string;
  content: string;
  exists: boolean;
}

export interface PipelineJobResult {
  ok: boolean;
  step: string;
  lines: string[];
  completionPct?: number;
}

export interface AiProviderGuide {
  id: CliEngine;
  title: string;
  accountReq: string;
  summary: string;
  installCmd: string;
  loginCmd: string;
}
