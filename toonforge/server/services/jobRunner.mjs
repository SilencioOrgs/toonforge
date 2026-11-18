import { exec, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  compositionIdFromSlug,
  fileExists,
  listDirSafe,
  sanitizeSlug,
  ValidationError,
} from './workspaceService.mjs';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Non-interactive "run one prompt" form of each agent CLI.
export const AI_ENGINE_ARGS = {
  claude: (prompt) => ({ bin: 'claude', args: ['-p', prompt] }),
  codex: (prompt) => ({ bin: 'codex', args: ['exec', prompt] }),
  opencode: (prompt) => ({ bin: 'opencode', args: ['run', prompt] }),
  agy: (prompt) => ({ bin: 'agy', args: ['--mode', 'accept-edits', '-p', prompt] }),
};

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
const AGENT_TIMEOUT_MS = 10 * 60 * 1000; // agent turns can take minutes

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

export async function execWorkspaceCommand(repoRoot, engine, command) {
  const trimmed = String(command || '').trim();
  if (!trimmed) {
    throw new ValidationError('Missing command', 400);
  }

  // The selected engine alone decides where the text goes: an agent gets it as a prompt
  // (never through a shell), and only engine "shell" runs it as a command.
  if (Object.hasOwn(AI_ENGINE_ARGS, engine)) {
    const spec = AI_ENGINE_ARGS[engine](trimmed);
    try {
      const { stdout, stderr } = await execFileAsync(spec.bin, spec.args, { cwd: repoRoot, timeout: AGENT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
      return { ok: true, engine, stdout, stderr };
    } catch (err) {
      return {
        ok: false,
        engine,
        stdout: err?.stdout || '',
        stderr: err?.code === 'ENOENT' ? `${spec.bin} is not installed or not on PATH.` : `${spec.bin} failed: ${String(err?.stderr || err?.message || err)}`,
      };
    }
  }
  if (engine !== 'shell') {
    throw new ValidationError(`Unknown engine "${String(engine || '')}"`, 400);
  }

  try {
    const { stdout, stderr } = await execAsync(trimmed, { cwd: repoRoot, timeout: 15000 });
    return { ok: true, engine, stdout, stderr };
  } catch (err) {
    return {
      ok: false,
      engine,
      stdout: err?.stdout || '',
      stderr: err?.stderr || String(err?.message || err),
    };
  }
}

export async function runPipelineAction(repoRoot, rawSlug, action) {
  const validActions = new Set(['stills', 'render', 'typecheck']);
  if (!validActions.has(action)) {
    throw new ValidationError(`Invalid pipeline action "${String(action || '')}"`, 400);
  }

  if (action === 'typecheck') {
    try {
      await execAsync('npx tsc --noEmit', { cwd: repoRoot, timeout: 25000 });
      return { ok: true, step: 'typecheck', lines: ['npx tsc --noEmit passed with 0 errors'] };
    } catch (err) {
      return {
        ok: false,
        step: 'typecheck',
        lines: [String(err?.stdout || err?.stderr || err?.message || err).slice(0, 240)],
      };
    }
  }

  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    throw new ValidationError('Invalid card slug for pipeline run', 400);
  }
  const outDir = path.join(repoRoot, 'out', slug);
  const compId = compositionIdFromSlug(slug);

  if (action === 'stills') {
    const stillsFiles = await listDirSafe(path.join(outDir, 'stills'));
    const qaSheets = await listDirSafe(path.join(outDir, 'qa'));
    const count = stillsFiles.length || qaSheets.filter((f) => f.startsWith('sheet_')).length;
    return {
      ok: count > 0,
      step: 'stills',
      lines: [
        count > 0
          ? `verified ${count} real still/contact images in out/${slug}`
          : `no stills yet in out/${slug}/stills — run node scripts/stills.mjs after scene build`,
      ],
    };
  }

  const qaPath = path.join(outDir, 'qa', 'report.md');
  if (await fileExists(qaPath)) {
    const report = await fs.readFile(qaPath, 'utf8');
    const lines = report.trim().split(/\r?\n/).slice(0, 6);
    const hasDefects =
      /FRAMES.*black \[\d+/.test(report) ||
      /unplanned white \[\d+/.test(report) ||
      /frozen spans >=12f \[\d+/.test(report);
    return { ok: !hasDefects, step: 'qa', completionPct: 100, lines };
  }

  return {
    ok: false,
    step: 'render',
    lines: [
      `No QA report found at out/${slug}/qa/report.md yet.`,
      `Render command: npx remotion render src/index.ts ${compId} out/${slug}/${slug}_2k.mp4 --codec h264 --crf 16 --scale 1.3333333333333333`,
      `Then QA: python scripts/short_qa.py out/${slug}/${slug}_2k.mp4 out/${slug}/qa`,
    ],
  };
}
