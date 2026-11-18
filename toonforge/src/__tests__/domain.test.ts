import { describe, expect, it } from 'vitest';
import {
  addCardToBoard,
  AI_PROVIDER_GUIDES,
  applyVoiceFilesToBoard,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  buildVideoStepPrompt,
  computeCardCompletionPct,
  generateScriptFromTopic,
  getTop10TopicsForNiche,
  moveCardToLane,
  NICHE_PRESETS,
  setCardRig,
  stripSfxTagsForVoiceover,
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
      { id: 'git', name: 'Git', installed: true, version: '2.56.0', role: 'Clone/sync template repository', installCmd: 'winget install Git.Git' },
      { id: 'node', name: 'Node.js', installed: true, version: 'v24.21.0', role: 'Runs Remotion 4 + TypeScript render', installCmd: 'winget install OpenJS.NodeJS.LTS' },
      { id: 'python', name: 'Python', installed: true, version: '3.12', role: 'Runs DSP audio mix & short_qa.py', installCmd: 'winget install Python.Python.3.12' },
      { id: 'ffmpeg', name: 'FFmpeg', installed: false, role: 'Normalizes -15 LUFS audio & frame QA', installCmd: 'winget install Gyan.FFmpeg' },
      { id: 'py_deps', name: 'NumPy + Pillow', installed: false, role: 'Powers scripts/short_qa.py frame stats', installCmd: 'python -m pip install numpy pillow' },
    ];

    const prompt = buildAiSetupPrompt('claude', probes);
    expect(prompt).toContain('claude');
    expect(prompt).toContain('ffmpeg');
    expect(prompt).toContain('py_deps');
    expect(prompt).toContain('npm ci');
    expect(prompt).toContain('scripts/short_qa.py');

    const manual = buildManualSetupCommands(probes);
    expect(manual).toContain('git clone');
    expect(manual).toContain('pip install numpy pillow');
    expect(manual).toContain('remotion browser ensure');
  });

  it('provides clear AI CLI provider account guides and per-card video creation prompts', () => {
    expect(AI_PROVIDER_GUIDES.claude.accountReq).toMatch(/Claude Pro/i);
    expect(AI_PROVIDER_GUIDES.agy.accountReq).toMatch(/Built-in|Antigravity/i);
    expect(AI_PROVIDER_GUIDES.codex.accountReq).toMatch(/ChatGPT/i);
    expect(AI_PROVIDER_GUIDES.opencode.accountReq).toMatch(/Open-source|API key/i);

    const card = sampleBoard().cards[1];
    const audioPrompt = buildVideoStepPrompt('audio', card, 'claude');
    expect(audioPrompt).toContain('audio/mix_dbindex.py');
    expect(audioPrompt).toContain('-15 LUFS');

    const renderPrompt = buildVideoStepPrompt('render', card, 'agy');
    expect(renderPrompt).toContain('DbIndexShort');
    expect(renderPrompt).toContain('scripts/short_qa.py');
  });

  it('computes deterministic completion percentage from real card artifacts and moves cards across lanes', () => {
    const base = sampleBoard().cards[0];
    expect(computeCardCompletionPct(base)).toBe(0);
    expect(computeCardCompletionPct({ ...base, scriptFile: 'SCRIPT_ASYNC.md' })).toBe(25);
    expect(computeCardCompletionPct({ ...base, scriptFile: 'SCRIPT_ASYNC.md', voiceFile: 'async_voice.wav' })).toBe(50);
    expect(computeCardCompletionPct({ ...base, scriptFile: 'SCRIPT_ASYNC.md', audioMode: 'no_vo', videoFile: 'out/async/a.mp4' })).toBe(75);
    expect(
      computeCardCompletionPct({
        ...base,
        scriptFile: 'SCRIPT_ASYNC.md',
        voiceFile: 'async_voice.wav',
        videoFile: 'out/async/a.mp4',
        qaReport: 'out/async/qa/report.md',
      }),
    ).toBe(100);

    const moved = moveCardToLane(sampleBoard(), 'async-queues', 'done');
    expect(moved.cards.find((c) => c.id === 'async-queues')?.lane).toBe('done');
    expect(moved.activeLane).toBe('done');
  });
});

describe('story flow domain helpers (niches, top-10 topics, localized script & VO clean text)', () => {
  it('exposes the 4 starter niche presets (crime, horror, tech, custom)', () => {
    expect(NICHE_PRESETS.map((n) => n.id)).toEqual(['crime', 'horror', 'tech', 'custom']);
    const crime = NICHE_PRESETS.find((n) => n.id === 'crime');
    expect(crime?.top10Prompt).toContain('Top 10');
  });

  it('returns 10 localized topics for crime, horror, tech, and parameterized custom niche', () => {
    const crimeTaglish = getTop10TopicsForNiche('crime', '', 'taglish');
    const crimeTagalog = getTop10TopicsForNiche('crime', '', 'tagalog');
    const crimeEnglish = getTop10TopicsForNiche('crime', '', 'english');

    expect(crimeTaglish).toHaveLength(10);
    expect(crimeTagalog).toHaveLength(10);
    expect(crimeEnglish).toHaveLength(10);
    expect(crimeTaglish[0].rank).toBe(1);
    expect(crimeTaglish[0].sfxCues.length).toBeGreaterThan(0);
    expect(crimeTaglish[0].hook).not.toBe(crimeEnglish[0].hook);
    expect(crimeTagalog[0].hook).not.toBe(crimeEnglish[0].hook);

    const customTopics = getTop10TopicsForNiche('custom', 'Philippine Urban Legends', 'taglish');
    expect(customTopics).toHaveLength(10);
    expect(customTopics[0].title).toContain('Philippine Urban Legends');
    expect(customTopics[0].niche).toBe('custom');
  });

  it('generates localized script markdown with [SFX] cues and strips tags cleanly for ElevenLabs VO', () => {
    const topic = getTop10TopicsForNiche('crime', '', 'tagalog')[0];
    const md = generateScriptFromTopic(topic, 'tagalog', 'chibi');

    expect(md).toContain('Pure Tagalog');
    expect(md).toContain('[SFX:');
    expect(md).toContain('Chibi');

    const cleanVo = stripSfxTagsForVoiceover(md);
    expect(cleanVo).not.toContain('[SFX:');
    expect(cleanVo).not.toContain('#');
    expect(cleanVo.length).toBeGreaterThan(40);
  });
});
