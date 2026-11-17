import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { BoardState, EnvStatus, RigSummary, ScriptDoc } from '../lib/domain';

const mockEnv: EnvStatus = {
  repoRoot: 'c:\\workspace\\toonforge',
  branch: 'main',
  probes: [
    { id: 'git', name: 'Git', installed: true, version: '2.56.0', role: 'Clones & syncs your template repository', installCmd: 'winget install Git.Git' },
    { id: 'node', name: 'Node.js (>=20)', installed: true, version: 'v24.21.0', role: 'Bundles TypeScript & renders Three.js/Remotion scenes', installCmd: 'winget install OpenJS.NodeJS.LTS' },
    { id: 'python', name: 'Python (>=3.10)', installed: true, version: '3.12', role: 'Runs VO sync, -15 LUFS DSP mix & frame QA', installCmd: 'winget install Python.Python.3.12' },
    { id: 'py_deps', name: 'NumPy + Pillow', installed: true, version: 'ok', role: 'Analyzes luminance & contact sheets in short_qa.py', installCmd: 'python -m pip install numpy pillow' },
    { id: 'ffmpeg', name: 'FFmpeg + FFprobe', installed: true, version: '7.1', role: 'Normalizes -15 LUFS audio & encodes MP4', installCmd: 'winget install Gyan.FFmpeg' },
    { id: 'chromium', name: 'Chromium / Chrome', installed: true, version: 'chrome.exe', role: 'Headless WebGL engine used by Remotion to render frames', installCmd: 'npx remotion browser ensure' },
    { id: 'agy', name: 'Antigravity CLI', installed: true, role: 'Built-in IDE coding agent', installCmd: 'Bundled' },
    { id: 'claude', name: 'Claude Code CLI', installed: false, role: 'Requires Claude Pro/Max', installCmd: 'npm install -g @anthropic-ai/claude-code' },
    { id: 'codex', name: 'Codex CLI', installed: false, role: 'Requires ChatGPT Plus', installCmd: 'npm install -g @openai/codex' },
    { id: 'opencode', name: 'OpenCode CLI', installed: false, role: 'Open-source BYOK CLI', installCmd: 'npm install -g opencode-ai' },
  ],
};

const mockRigs: RigSummary = {
  stickman: { ready: true, label: 'Built-in Procedural Stickman' },
  chibi: {
    ready: true,
    sprites: 21,
    faces: 16,
    fx: 6,
    spriteFiles: ['idle.png', 'cheer.png'],
    faceFiles: ['happy.png', 'focus.png'],
    fxFiles: ['sparkle.png'],
  },
};

const initialBoard: BoardState = {
  version: 1,
  autoQueue: true,
  activeLane: 'queued',
  selectedCardId: 'dbindex',
  cards: [
    {
      id: 'async',
      slug: 'async',
      title: 'Async Job Queues',
      lane: 'backlog',
      audioMode: 'needs_vo',
      rigMode: 'chibi',
      durationLabel: 'Script Ready',
      compositionId: 'AsyncShort',
      scriptFile: 'SCRIPT_ASYNC.md',
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
      scriptFile: 'SCRIPT_DBINDEX.md',
      voiceFile: 'dbindex_voice.wav',
      voicePath: 'voice/dbindex_voice.wav',
      mixScript: 'audio/mix_dbindex.py',
      mixWavFile: 'audio/mix_dbindex.wav',
      videoFile: 'out/dbindex/dbindex_2k.mp4',
      qaReport: 'out/dbindex/qa/report.md',
      loudness: '-15.1 LUFS',
      specs: '1440x2560 30/1 fps, 2812 frames',
      stills: ['out/dbindex/qa/sheet_0000.jpg'],
    },
  ],
};

vi.mock('../lib/backend', () => ({
  getEnvStatus: vi.fn(async () => mockEnv),
  getRigs: vi.fn(async () => mockRigs),
  loadBoard: vi.fn(async () => structuredClone(initialBoard)),
  saveBoard: vi.fn(async (board: BoardState) => board),
  createCard: vi.fn(async (title: string) => ({
    ...initialBoard,
    activeLane: 'backlog' as const,
    cards: [
      {
        id: 'newshort',
        slug: 'newshort',
        title,
        lane: 'backlog' as const,
        audioMode: 'needs_vo' as const,
        rigMode: 'chibi' as const,
        durationLabel: 'Script Ready',
        compositionId: 'NewshortShort',
        scriptFile: 'SCRIPT_NEWSHORT.md',
      },
      ...initialBoard.cards,
    ],
  })),
  getCardScript: vi.fn(async (slug: string): Promise<ScriptDoc> => ({
    slug,
    file: `SCRIPT_${slug.toUpperCase()}.md`,
    exists: true,
    content: '# DbIndex Script\nHook: Slow search query fixed by B-Tree!',
  })),
  saveCardScript: vi.fn(async (slug: string, content: string): Promise<ScriptDoc> => ({
    slug,
    file: `SCRIPT_${slug.toUpperCase()}.md`,
    exists: true,
    content,
  })),
  syncRepo: vi.fn(async () => ({ ok: true, lines: ['working tree clean · main'] })),
  runPipeline: vi.fn(async () => ({ ok: true, step: 'qa', completionPct: 100, lines: ['SPECS 1440x2560 OK', 'QA Pass'] })),
  execCliCommand: vi.fn(async (_engine: string, cmd: string) => ({
    ok: true,
    stdout: `executed: ${cmd}`,
    stderr: '',
  })),
  mediaUrl: vi.fn((relPath: string) => `/api/media?path=${encodeURIComponent(relPath)}`),
}));

describe('ToonForge Full-Stack Modular Studio UI', () => {
  it('toggles Light/Dark monochrome themes and renders real workspace card telemetry', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());
    expect(screen.getAllByText(/-15\.1 LUFS/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/100%/)).toBeInTheDocument();

    const frame = document.getElementById('studio-frame');
    expect(frame).toHaveAttribute('data-mode', 'dark');
    fireEvent.click(screen.getByRole('button', { name: /Light/i }));
    expect(frame).toHaveAttribute('data-mode', 'light');
  });

  it('shows live icon samples inside Choose Icon dialog and video-creation dependencies inside Setup Guide', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));
    expect(screen.getByText('Live Icon Sample')).toBeInTheDocument();
    expect(screen.getByText('App Dock')).toBeInTheDocument();
    expect(screen.getByText('9:16 Short')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply Icon/i }));

    fireEvent.click(screen.getByRole('button', { name: /Setup Guide/i }));
    expect(screen.getByText(/Needed to Create Videos/i)).toBeInTheDocument();
    expect(document.querySelector('.req-list')?.textContent).toMatch(/NumPy \+ Pillow/i);
    expect(screen.getByText(/Headless WebGL engine/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Manual Terminal/i }));
    expect(screen.getByText(/pip install numpy pillow/i)).toBeInTheDocument();
  });

  it('switches Center Stage across Real Chibi PNG Sprite Compositor, Video player, Stills strip, and live Script/Audio editor', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    expect(document.querySelector('img[src*="sprites%2Fidle.png"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Video$/i }));
    expect(document.querySelector('video')?.getAttribute('src')).toContain('out%2Fdbindex%2Fdbindex_2k.mp4');

    fireEvent.click(screen.getByRole('button', { name: /^Stills$/i }));
    expect(document.querySelector('img[src*="sheet_0000.jpg"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Script$/i }));
    await waitFor(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(ta?.value).toContain('B-Tree');
    });
    expect(document.querySelector('audio[src*="mix_dbindex.wav"]')).toBeInTheDocument();
  });

  it('explains AI CLI account requirements clearly and builds per-card guided prompts', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    expect(document.querySelector('.ai-guide-bar')?.textContent).toMatch(/Built-in with Antigravity IDE/i);

    fireEvent.click(screen.getByRole('button', { name: /Claude/i }));
    expect(document.querySelector('.ai-guide-bar')?.textContent).toMatch(/Requires Claude Pro \/ Max account/i);

    fireEvent.click(screen.getByRole('button', { name: /2\. Audio Mix/i }));
    await waitFor(() => {
      expect(document.querySelector('.cli-log')?.textContent).toMatch(/audio\/mix_dbindex\.py/i);
    });
  });

  it('auto-queues Backlog cards when toggled to VO Ready while Auto-Q is ON', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Backlog/i }));
    fireEvent.click(screen.getByRole('button', { name: /Needs VO/i }));
    await waitFor(() => {
      expect(screen.getByText('Async Job Queues')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /VO Ready/i })).toHaveLength(2);
    });
  });
});
