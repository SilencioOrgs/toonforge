import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    { id: 'skill', name: 'claude-animated-shorts skill', installed: true, version: '~/.claude/skills/cartoon-3d-short', role: 'The pipeline your agent follows', installCmd: 'git clone ...' },
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
  getEnvStatus: vi.fn(async () => structuredClone(mockEnv)),
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
  uploadVoiceover: vi.fn(async (slug: string, fileName: string) => ({
    ...initialBoard,
    activeLane: 'queued' as const,
    selectedCardId: slug,
    cards: [
      {
        id: slug,
        slug,
        title: 'The Locked Apartment Keyhole Mystery',
        lane: 'queued' as const,
        audioMode: 'vo_ready' as const,
        rigMode: 'chibi' as const,
        durationLabel: 'VO Ready',
        compositionId: 'LockedShort',
        scriptFile: `SCRIPT_${slug.toUpperCase()}.md`,
        voiceFile: `${slug}_voice.wav`,
        voicePath: `voice/${slug}_voice.wav`,
      },
      ...initialBoard.cards,
    ],
  })),
  installTool: vi.fn(async (id: string) => {
    mockEnv.probes = mockEnv.probes.map((p) => (p.id === id ? { ...p, installed: true, version: 'PATH ready' } : p));
    return { ok: true, lines: [`${id} installed`] };
  }),
  syncRepo: vi.fn(async () => ({ ok: true, lines: ['working tree clean · main'] })),
  runPipeline: vi.fn(async () => ({ ok: true, step: 'qa', completionPct: 100, lines: ['SPECS 1440x2560 OK', 'QA Pass'] })),
  execCliCommand: vi.fn(async (_engine: string, cmd: string) => ({
    ok: true,
    stdout: `executed: ${cmd}`,
    stderr: '',
  })),
  mediaUrl: vi.fn((relPath: string) => `/api/media?path=${encodeURIComponent(relPath)}`),
}));


async function renderApp() {
  render(<App />);
  // Wait for the workspace (board + probes) to load.
  await waitFor(() => expect(screen.getByRole('combobox', { name: /Current short/i })).toHaveValue('dbindex'));
}

const nav = (name: RegExp) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name }));

describe('ToonForge studio shell', () => {
  it('opens on an introduction that explains the skill pipeline and requirement status', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: /Animated story shorts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'claude-animated-shorts' })).toHaveAttribute('href', expect.stringContaining('mromidev/claude-animated-shorts'));
    expect(screen.getByText(/Everything needed to render is installed/i)).toBeInTheDocument();
    for (const step of ['Topic', 'Script', 'Voice', 'Scenes', 'Sound', 'Look check', 'Render & QA']) {
      expect(screen.getAllByRole('button', { name: new RegExp(`^${step.replace('&', '\&')}`) }).length).toBeGreaterThan(0);
    }
  });

  it('shows how to use and the requirements with install commands', async () => {
    await renderApp();
    nav(/How to use/);
    expect(screen.getByRole('heading', { name: /Install the skill/i })).toBeInTheDocument();
    expect(screen.getAllByText(/git clone https:\/\/github.com\/mromidev\/claude-animated-shorts/).length).toBeGreaterThan(0);

    nav(/Requirements/);
    expect(screen.getByText('NumPy + Pillow')).toBeInTheDocument();
    expect(screen.getByText('Claude Code CLI')).toBeInTheDocument();
    expect(screen.getByText('claude-animated-shorts skill')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Run commands yourself/i }));
    expect(screen.getByText(/pip install numpy pillow/i)).toBeInTheDocument();
  });

  it('installs a missing agent from the Requirements list without a terminal', async () => {
    await renderApp();
    nav(/Requirements/);
    const install = screen.getByRole('button', { name: 'Install Codex CLI' });
    expect(screen.getAllByText('Optional').length).toBeGreaterThan(0);
    fireEvent.click(install);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install Codex CLI' })).not.toBeInTheDocument());
    expect(screen.getAllByText('Installed').length).toBeGreaterThan(8);
  });

  it('walks a new short from topic to script to voice', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'New short' }));
    expect(screen.getByRole('heading', { name: /1\. Topic/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /The Locked Apartment Keyhole Mystery/i }));

    expect(screen.getByRole('heading', { name: /2\. Script/ })).toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: 'Script' }) as HTMLTextAreaElement).value).toContain('[SFX:');
    expect(screen.getByText(/Estimated length/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save short/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /3\. Voice/ })).toBeInTheDocument());
    expect(screen.getByTestId('clean-vo-text').textContent).not.toContain('[SFX:');
    const file = new File(['RIFF0000WAVE'], 'crime_vo.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Voice file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Attached crime_vo\.wav/i)).toBeInTheDocument());
  });

  it('shows saved artifacts on scene, look check, and render steps', async () => {
    await renderApp();
    nav(/^Scenes/);
    expect(document.querySelector('img[src*="sprites%2Fidle.png"]')).toBeInTheDocument();
    nav(/^Look check/);
    expect(document.querySelector('img[src*="sheet_0000.jpg"]')).toBeInTheDocument();
    nav(/^Render/);
    expect(document.querySelector('video')?.getAttribute('src')).toContain('out%2Fdbindex%2Fdbindex_2k.mp4');
    expect(screen.getByText('-15.1 LUFS')).toBeInTheDocument();
  });

  it('sends a step prompt to the agent terminal and explains each agent', async () => {
    await renderApp();
    nav(/^Sound/);
    fireEvent.click(screen.getByRole('button', { name: /Send to agent/i }));
    const prompt = screen.getByRole('textbox', { name: 'Agent prompt' }) as HTMLTextAreaElement;
    expect(prompt.value).toMatch(/audio\/mix_dbindex\.wav/);
    expect(screen.getByText(/Requires Claude Pro \/ Max account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(screen.getByText(/Requires ChatGPT Plus/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Run$/ }));
    await waitFor(() => expect(document.querySelector('.log')?.textContent).toMatch(/executed: Use the cartoon short skill/));
  });

  it('auto-queues a backlog short when its voice is marked ready, and toggles theme', async () => {
    await renderApp();
    nav(/All shorts/);
    fireEvent.click(screen.getByRole('tab', { name: /Backlog/i }));
    fireEvent.click(screen.getByRole('button', { name: /Needs voice/i }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Queued/i })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getAllByRole('button', { name: /Voice ready/i })).toHaveLength(2);

    const frame = document.getElementById('studio-frame');
    expect(frame).toHaveAttribute('data-mode', 'dark');
    fireEvent.click(screen.getByRole('button', { name: /Switch to light theme/i }));
    expect(frame).toHaveAttribute('data-mode', 'light');
  });
});
