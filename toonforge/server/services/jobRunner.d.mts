export const AI_ENGINE_ARGS: Record<'claude' | 'codex' | 'opencode' | 'agy', (prompt: string) => { bin: string; args: string[] }>;
export const SKILL_REPO: string;
export function installCommand(id: string, platform?: string): string | undefined;
export function installTool(repoRoot: string, id: string, home?: string): Promise<{ ok: boolean; id: string; lines: string[] }>;
