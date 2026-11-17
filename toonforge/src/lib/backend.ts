import type { BoardState, CliEngine, EnvStatus, RigMode, RigSummary } from './domain';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function httpJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`Bridge request failed (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

export async function getEnvStatus(): Promise<EnvStatus> {
  if (isTauriRuntime()) return tauriInvoke<EnvStatus>('check_environment');
  return httpJson<EnvStatus>('/api/env');
}

export async function getRigs(): Promise<RigSummary> {
  if (isTauriRuntime()) return tauriInvoke<RigSummary>('inspect_rigs');
  return httpJson<RigSummary>('/api/rigs');
}

export async function loadBoard(): Promise<BoardState> {
  if (isTauriRuntime()) return tauriInvoke<BoardState>('load_board');
  return httpJson<BoardState>('/api/board');
}

export async function saveBoard(board: BoardState): Promise<BoardState> {
  if (isTauriRuntime()) return tauriInvoke<BoardState>('save_board', { board });
  return httpJson<BoardState>('/api/board', {
    method: 'POST',
    body: JSON.stringify(board),
  });
}

export async function createCard(title: string, rigMode: RigMode): Promise<BoardState> {
  if (isTauriRuntime()) return tauriInvoke<BoardState>('create_card', { title, rigMode });
  return httpJson<BoardState>('/api/cards', {
    method: 'POST',
    body: JSON.stringify({ title, rigMode }),
  });
}

export async function syncRepo(): Promise<{ ok: boolean; lines: string[] }> {
  if (isTauriRuntime()) return tauriInvoke<{ ok: boolean; lines: string[] }>('sync_repo');
  return httpJson<{ ok: boolean; lines: string[] }>('/api/sync', { method: 'POST', body: '{}' });
}

export async function runPipeline(
  slug: string,
  action: 'stills' | 'render',
): Promise<{ ok: boolean; step: string; lines: string[] }> {
  if (isTauriRuntime()) {
    return tauriInvoke<{ ok: boolean; step: string; lines: string[] }>('run_pipeline', {
      slug,
      action,
    });
  }
  return httpJson<{ ok: boolean; step: string; lines: string[] }>('/api/pipeline/run', {
    method: 'POST',
    body: JSON.stringify({ slug, action }),
  });
}

export async function execCliCommand(
  engine: CliEngine | 'shell',
  command: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  if (isTauriRuntime()) {
    return tauriInvoke<{ ok: boolean; stdout: string; stderr: string }>('exec_cli_command', {
      engine,
      command,
    });
  }
  return httpJson<{ ok: boolean; stdout: string; stderr: string }>('/api/cli/exec', {
    method: 'POST',
    body: JSON.stringify({ engine, command }),
  });
}

export function mediaUrl(relPath: string): string {
  return `/api/media?path=${encodeURIComponent(relPath)}`;
}
