import { describe, expect, it } from 'vitest';
import {
  addCardToBoard,
  applyVoiceFilesToBoard,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  setCardRig,
  toggleCardAudioMode,
  type BoardState,
  type EnvProbe,
} from '../lib/domain';

function sampleBoard(autoQueue = true): BoardState {
  return {
    version: 1,
    autoQueue,
    activeLane: 'backlog',
    selectedCardId: 'async-queues',
    cards: [
      {
        id: 'async-queues',
        slug: 'async',
        title: 'Async Job Queues',
        lane: 'backlog',
        audioMode: 'needs_vo',
        rigMode: 'chibi',
        durationLabel: 'Script Ready',
        compositionId: 'AsyncShort',
      },
      {
        id: 'dbindex',
        slug: 'dbindex',
        title: 'DbIndex (B-Tree)',
        lane: 'queued',
        audioMode: 'vo_ready',
        rigMode: 'chibi',
        durationLabel: '93.7s VO',
        compositionId: 'DbIndexShort',
      },
    ],
  };
}

describe('ToonForge domain Kanban & Auto-Queue state machine', () => {
  it('cycles needs_vo -> vo_ready -> no_vo -> needs_vo and auto-queues backlog cards when autoQueue=true', () => {
    const start = sampleBoard(true);
    const step1 = toggleCardAudioMode(start, 'async-queues');
    const c1 = step1.cards.find((c) => c.id === 'async-queues')!;
    expect(c1.audioMode).toBe('vo_ready');
    expect(c1.lane).toBe('queued');
    expect(step1.activeLane).toBe('queued');
    expect(step1.selectedCardId).toBe('async-queues');

    const step2 = toggleCardAudioMode(step1, 'async-queues');
    const c2 = step2.cards.find((c) => c.id === 'async-queues')!;
    expect(c2.audioMode).toBe('no_vo');
    expect(c2.durationLabel).toBe('Visual Only');

    const step3 = toggleCardAudioMode(step2, 'async-queues');
    const c3 = step3.cards.find((c) => c.id === 'async-queues')!;
    expect(c3.audioMode).toBe('needs_vo');
    expect(c3.durationLabel).toBe('Script Ready');
  });

  it('auto-queues a backlog No-VO card when autoQueue is ON, and keeps it in backlog when OFF', () => {
    const offBoard = sampleBoard(false);
    const toggledOff = toggleCardAudioMode(offBoard, 'async-queues');
    expect(toggledOff.cards[0].lane).toBe('backlog');

    const noVoBoard: BoardState = {
      ...sampleBoard(true),
      cards: [
        {
          id: 'load-bal',
          slug: 'loadbal',
          title: 'Load Balancing',
          lane: 'backlog',
          audioMode: 'vo_ready',
          rigMode: 'stickman',
          durationLabel: '60s VO',
          compositionId: 'LoadBalShort',
        },
      ],
    };
    const next = toggleCardAudioMode(noVoBoard, 'load-bal');
    expect(next.cards[0].audioMode).toBe('no_vo');
    expect(next.cards[0].lane).toBe('queued');
  });

  it('matches discovered voice files by slug and auto-queues backlog cards', () => {
    const start = sampleBoard(true);
    const updated = applyVoiceFilesToBoard(start, ['async_voice.wav', 'other_voice.wav']);
    const asyncCard = updated.cards.find((c) => c.slug === 'async')!;
    expect(asyncCard.audioMode).toBe('vo_ready');
    expect(asyncCard.lane).toBe('queued');
  });

  it('adds new cards to backlog and switches character rigs between stickman and chibi', () => {
    const withNew = addCardToBoard(sampleBoard(true), 'CAP Theorem', 'stickman');
    expect(withNew.cards[0].title).toBe('CAP Theorem');
    expect(withNew.cards[0].lane).toBe('backlog');
    expect(withNew.cards[0].rigMode).toBe('stickman');

    const switched = setCardRig(withNew, withNew.cards[0].id, 'chibi');
    expect(switched.cards[0].rigMode).toBe('chibi');
  });

  it('builds AI setup prompts and manual shell setup commands aware of missing toolchain probes', () => {
    const probes: EnvProbe[] = [
      { id: 'git', name: 'Git', installed: true, version: '2.56.0' },
      { id: 'node', name: 'Node.js', installed: true, version: 'v24.21.0' },
      { id: 'python', name: 'Python', installed: true, version: '3.12' },
      { id: 'ffmpeg', name: 'FFmpeg', installed: false },
      { id: 'cargo', name: 'Rust / Cargo', installed: false },
    ];

    const prompt = buildAiSetupPrompt('claude', probes);
    expect(prompt).toContain('claude');
    expect(prompt).toContain('ffmpeg');
    expect(prompt).toContain('cargo');
    expect(prompt).toContain('npm ci');
    expect(prompt).toContain('scripts/short_qa.py');

    const manual = buildManualSetupCommands(probes);
    expect(manual).toContain('git clone');
    expect(manual).toContain('pip install numpy pillow');
    expect(manual).toContain('remotion browser ensure');
  });
});
