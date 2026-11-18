import { exec, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  fileExists,
  ValidationError,
} from './workspaceService.mjs';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// One-click installers, keyed by probe id. The client only ever sends an id; commands are fixed here.
const WINGET = (pkg) => `winget install -e --id ${pkg} --silent --accept-source-agreements --accept-package-agreements`;
const INSTALLERS = {
  git: { win32: WINGET('Git.Git') },
  node: { win32: WINGET('OpenJS.NodeJS.LTS') },
  python: { win32: WINGET('Python.Python.3.12') },
  ffmpeg: { win32: WINGET('Gyan.FFmpeg') },
  py_deps: { any: 'python -m pip install numpy pillow' },
  whisper: { any: 'python -m pip install faster-whisper' },
  chromium: { any: 'npx remotion browser ensure' },
  claude: { any: 'npm install -g @anthropic-ai/claude-code' },
  codex: { any: 'npm install -g @openai/codex' },
  opencode: { any: 'npm install -g opencode-ai' },
};
export const SKILL_REPO = 'https://github.com/mromidev/claude-animated-shorts';
const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;

export function installCommand(id, platform = process.platform) {
  const entry = Object.hasOwn(INSTALLERS, id) ? INSTALLERS[id] : undefined;
  return entry?.any ?? (platform === 'win32' ? entry?.win32 : undefined);
}

const tail = (text) => String(text || '').trim().split(/\r?\n/).filter(Boolean).slice(-6);

export async function installTool(repoRoot, id, home = os.homedir()) {
  if (id === 'skill') {
    const dest = path.join(home, '.claude', 'skills', 'cartoon-3d-short');
    if (await fileExists(path.join(dest, 'SKILL.md'))) return { ok: true, id, lines: ['Skill is already installed.'] };
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      const { stdout, stderr } = await execFileAsync('git', ['clone', '--depth', '1', SKILL_REPO, dest], { timeout: INSTALL_TIMEOUT_MS });
      return { ok: true, id, lines: [...tail(stdout), ...tail(stderr), `Installed to ${dest}`] };
    } catch (err) {
      return { ok: false, id, lines: tail(err?.stderr || err?.message || err) };
    }
  }
  const cmd = installCommand(id);
  if (!cmd) throw new ValidationError(`No automatic installer for "${String(id || '')}" on this system`, 400);
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: repoRoot, timeout: INSTALL_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
    return { ok: true, id, lines: [...tail(stdout), ...tail(stderr)] };
  } catch (err) {
    return { ok: false, id, lines: [...tail(err?.stdout), ...tail(err?.stderr || err?.message || err)] };
  }
}

export async function runSyncRepo(repoRoot) {
  try {
    const { stdout: statusOut } = await execFileAsync('git', ['status', '--short'], { cwd: repoRoot, timeout: 4000 });
    const { stdout: remoteOut } = await execFileAsync('git', ['remote'], { cwd: repoRoot, timeout: 2500 });
    const lines = [];
    if (remoteOut.trim()) {
      const pull = await execFileAsync('git', ['pull', '--ff-only'], { cwd: repoRoot, timeout: 10000 });
      if (pull.stdout.trim()) lines.push(pull.stdout.trim());
    } else {
      lines.push('local git repo clean (no upstream remote configured yet)');
    }
    lines.push(statusOut.trim() ? `modified entries: ${statusOut.trim().split(/\r?\n/).length}` : 'working tree clean');
    return { ok: true, lines };
  } catch (err) {
    return { ok: false, lines: [String(err?.message || err)] };
  }
}
