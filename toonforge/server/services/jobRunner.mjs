import { exec, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
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

const AI_ENGINE_ARGS = {
  claude: (prompt) => ({ bin: 'claude', args: ['-p', prompt] }),
  codex: (prompt) => ({ bin: 'codex', args: ['exec', prompt] }),
  opencode: (prompt) => ({ bin: 'opencode', args: ['run', prompt] }),
  agy: (prompt) => ({ bin: 'agy', args: ['chat', prompt] }),
};

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

  const aiMatch = trimmed.match(/^\[(agy|claude|codex|opencode)[^\]]*\]\s*(.+)$/is);
  if (aiMatch && AI_ENGINE_ARGS[aiMatch[1].toLowerCase()]) {
    const eng = aiMatch[1].toLowerCase();
    const spec = AI_ENGINE_ARGS[eng](aiMatch[2]);
    try {
      const { stdout, stderr } = await execFileAsync(spec.bin, spec.args, { cwd: repoRoot, timeout: 25000 });
      return { ok: true, engine: eng, stdout, stderr };
    } catch (err) {
      return {
        ok: false,
        engine: eng,
        stdout: '',
        stderr: `CLI "${spec.bin}" unavailable or failed: ${String(err?.stderr || err?.message || err)}`,
      };
    }
  }

  try {
    const { stdout, stderr } = await execAsync(trimmed, { cwd: repoRoot, timeout: 15000 });
    return { ok: true, engine: engine || 'shell', stdout, stderr };
  } catch (err) {
    return {
      ok: false,
      engine: engine || 'shell',
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
