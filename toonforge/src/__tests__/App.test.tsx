import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { BoardState, EnvStatus, RigSummary } from '../lib/domain';

const mockEnv: EnvStatus = {
  repoRoot: 'c:\\workspace\\toonforge',
  branch: 'main',
  probes: [
    { id: 'git', name: 'Git', installed: true, version: '2.56.0' },
    { id: 'node', name: 'Node.js', installed: true, version: 'v24.21.0' },
    { id: 'python', name: 'Python', installed: true, version: '3.12' },
    { id: 'ffmpeg', name: 'FFmpeg', installed: true, version: '7.1' },
    { id: 'cargo', name: 'Rust / Cargo', installed: false },
    { id: 'agy', name: 'Antigravity CLI', installed: true },
    { id: 'claude', name: 'Claude Code CLI', installed: false },
    { id: 'codex', name: 'Codex CLI', installed: false },
    { id: 'opencode', name: 'OpenCode CLI', installed: false },
  ],
};

const mockRigs: RigSummary = {
  stickman: { ready: true, label: 'Built-in Procedural Stickman' },
  chibi: { ready: true, sprites: 21, faces: 16, fx: 6 },
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

vi.mock('../lib/backend', () => ({
  getEnvStatus: vi.fn(async () => mockEnv),
  getRigs: vi.fn(async () => mockRigs),
  loadBoard: vi.fn(async () => structuredClone(initialBoard)),
  saveBoard: vi.fn(async (board: BoardState) => board),
  syncRepo: vi.fn(async () => ({ ok: true, lines: ['git status clean · synced main'] })),
  runPipeline: vi.fn(async () => ({ ok: true, step: 'qa', lines: ['SPECS 1440x2560 OK', 'QA Pass'] })),
  execCliCommand: vi.fn(async (_engine: string, cmd: string) => ({
    ok: true,
    stdout: `executed: ${cmd}`,
    stderr: '',
  })),
}));

describe('ToonForge Studio App UI', () => {
  it('renders QuickLiquid monochrome chrome, Priority controls, and toggles Light/Dark themes', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    const frame = document.getElementById('studio-frame');
    expect(frame).toHaveAttribute('data-mode', 'dark');

    fireEvent.click(screen.getByRole('button', { name: /Light/i }));
    expect(frame).toHaveAttribute('data-mode', 'light');
    expect(screen.getByRole('button', { name: /Dark/i })).toBeInTheDocument();
  });

  it('opens Compare icon modal and First-Run Setup Guide modal cleanly', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('ToonForge')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));
    expect(screen.getByText('Choose ToonForge App Icon')).toBeInTheDocument();
    expect(screen.getByText('Iso Cube + Chibi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply Icon/i }));

    fireEvent.click(screen.getByRole('button', { name: /Setup Guide/i }));
    expect(screen.getByText('First-Run Setup & Walkthrough')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Manual Terminal/i }));
    expect(screen.getByText(/pip install numpy pillow/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quick Walkthrough/i }));
    expect(screen.getByText(/Sync Template Repo & Toolchain/i)).toBeInTheDocument();
  });

  it('auto-queues Backlog cards when audio badge is switched to VO Ready while Auto-Q is ON', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Backlog/i }));
    expect(screen.getByText('Async Job Queues')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Needs VO/i }));
    await waitFor(() => {
      expect(screen.getByText('Async Job Queues')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /VO Ready/i })).toHaveLength(2);
    });
  });

  it('switches character rigs and AI CLI agents with workspace macros', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('DbIndex (B-Tree)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Stickman/i }));
    expect(screen.getByText(/Built-in Stickman rig/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Claude/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Build Card/i }));
    await waitFor(() => {
      expect(document.querySelector('.cli-log')?.textContent).toMatch(/claude > "Build from active Trello card/i);
    });
  });
});
