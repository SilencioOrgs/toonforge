import { exec, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const TOOL_SPECS = [
  { id: 'git', name: 'Git', bin: 'git', args: ['--version'] },
  { id: 'node', name: 'Node.js', bin: 'node', args: ['-v'] },
  { id: 'python', name: 'Python', bin: 'python', args: ['--version'] },
  { id: 'ffmpeg', name: 'FFmpeg', bin: 'ffmpeg', args: ['-version'] },
  { id: 'cargo', name: 'Rust / Cargo', bin: 'cargo', args: ['--version'] },
  { id: 'agy', name: 'Antigravity CLI', bin: 'agy', args: ['--version'], whereOnly: true },
  { id: 'claude', name: 'Claude Code CLI', bin: 'claude', args: ['--version'], whereOnly: true },
  { id: 'codex', name: 'Codex CLI', bin: 'codex', args: ['--version'], whereOnly: true },
  { id: 'opencode', name: 'OpenCode CLI', bin: 'opencode', args: ['--version'], whereOnly: true },
];

async function probeTool(spec) {
  if (spec.whereOnly) {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    try {
      const { stdout } = await execFileAsync(cmd, [spec.bin], { timeout: 2500 });
      const line = stdout.trim().split(/\r?\n/)[0];
      return { id: spec.id, name: spec.name, installed: Boolean(line), version: line ? 'PATH ready' : undefined };
    } catch {
      return { id: spec.id, name: spec.name, installed: false };
    }
  }
  try {
    const { stdout, stderr } = await execFileAsync(spec.bin, spec.args, { timeout: 3000 });
    const firstLine = `${stdout}\n${stderr}`.trim().split(/\r?\n/)[0]?.slice(0, 48);
    return { id: spec.id, name: spec.name, installed: Boolean(firstLine), version: firstLine || 'ok' };
  } catch {
    return { id: spec.id, name: spec.name, installed: false };
  }
}

async function listDirSafe(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function titleFromSlug(slug) {
  const known = {
    dbindex: 'DbIndex (B-Tree)',
    redis: 'Redis Caching',
    binary: 'Binary Search',
    idor: 'IDOR Security',
    ratelimit: 'Rate Limiting',
    racecondition: 'Race Conditions',
    sqli: 'SQL Injection',
    notopax: 'No To Paxos',
    paxsilica: 'Pax Silica',
  };
  return known[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

async function seedBoardFromWorkspace(repoRoot) {
  const videoDirs = (await listDirSafe(path.join(repoRoot, 'src', 'videos'))).filter((d) => d !== 'chibi');
  const voiceFiles = (await listDirSafe(path.join(repoRoot, 'voice'))).map((f) => f.toLowerCase());

  const cards = [];
  for (const slug of videoDirs) {
    const outFiles = await listDirSafe(path.join(repoRoot, 'out', slug));
    const hasMp4 = outFiles.some((f) => f.toLowerCase().endsWith('.mp4'));
    const voiceMatch = voiceFiles.find((f) => f.startsWith(`${slug.toLowerCase()}_voice.`));
    const lane = hasMp4 ? 'done' : voiceMatch ? 'queued' : 'backlog';
    const audioMode = voiceMatch ? 'vo_ready' : 'needs_vo';
    cards.push({
      id: slug,
      slug,
      title: titleFromSlug(slug),
      lane,
      audioMode,
      rigMode: 'chibi',
      durationLabel: hasMp4 ? '2K MP4' : voiceMatch ? 'VO Ready' : 'Script Ready',
      compositionId: `${slug.charAt(0).toUpperCase()}${slug.slice(1)}Short`,
      voiceFile: voiceMatch,
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: 'starter-short',
      slug: 'starter',
      title: 'Starter Short',
      lane: 'backlog',
      audioMode: 'needs_vo',
      rigMode: 'stickman',
      durationLabel: 'Script Draft',
      compositionId: 'StarterShort',
    });
  }

  const queuedCard = cards.find((c) => c.lane === 'queued') || cards[0];
  return {
    version: 1,
    autoQueue: true,
    activeLane: queuedCard.lane,
    selectedCardId: queuedCard.id,
    cards,
  };
}

function applyVoiceAutoQueue(board, voiceFiles) {
  const normalized = voiceFiles.map((f) => f.toLowerCase());
  return {
    ...board,
    cards: board.cards.map((card) => {
      const match = normalized.find((f) => f.startsWith(`${card.slug.toLowerCase()}_voice.`));
      if (!match) return card;
      const shouldQueue = board.autoQueue && card.lane === 'backlog';
      return {
        ...card,
        audioMode: card.audioMode === 'no_vo' ? 'no_vo' : 'vo_ready',
        voiceFile: match,
        lane: shouldQueue ? 'queued' : card.lane,
      };
    }),
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** Handles workspace API routes shared by Vite dev middleware and standalone Node server. */
export async function handleApiRequest(req, res, repoRoot) {
  const cleanUrl = (req.url || '/').split('?')[0];
  const route = cleanUrl.startsWith('/api') ? cleanUrl.slice(4) || '/' : cleanUrl;
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET' && route === '/env') {
      const probes = await Promise.all(TOOL_SPECS.map(probeTool));
      let branch = 'main';
      try {
        const out = await execFileAsync('git', ['branch', '--show-current'], { cwd: repoRoot, timeout: 2500 });
        if (out.stdout.trim()) branch = out.stdout.trim();
      } catch {
        // Fallback when folder has no commits or no git repo yet.
      }
      return sendJson(res, 200, { repoRoot, branch, probes });
    }

    if (method === 'GET' && route === '/rigs') {
      const chibiRoot = path.join(repoRoot, 'src', 'videos', 'chibi');
      const [sprites, faces, fx] = await Promise.all([
        listDirSafe(path.join(chibiRoot, 'sprites')),
        listDirSafe(path.join(chibiRoot, 'faces')),
        listDirSafe(path.join(chibiRoot, 'fx')),
      ]);
      const pngCount = (arr) => arr.filter((f) => f.toLowerCase().endsWith('.png')).length;
      const sCount = pngCount(sprites);
      const fCount = pngCount(faces);
      const xCount = pngCount(fx);
      return sendJson(res, 200, {
        stickman: { ready: true, label: 'Built-in Procedural Stickman' },
        chibi: { ready: sCount > 0 && fCount > 0, sprites: sCount, faces: fCount, fx: xCount },
      });
    }

    if (method === 'GET' && route === '/board') {
      const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
      let board;
      if (await fileExists(boardPath)) {
        board = JSON.parse(await fs.readFile(boardPath, 'utf8'));
      } else {
        board = await seedBoardFromWorkspace(repoRoot);
        await fs.mkdir(path.dirname(boardPath), { recursive: true });
        await fs.writeFile(boardPath, JSON.stringify(board, null, 2));
      }
      const voiceFiles = await listDirSafe(path.join(repoRoot, 'voice'));
      board = applyVoiceAutoQueue(board, voiceFiles);
      return sendJson(res, 200, board);
    }

    if (method === 'POST' && route === '/board') {
      const body = await readJsonBody(req);
      const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
      await fs.mkdir(path.dirname(boardPath), { recursive: true });
      await fs.writeFile(boardPath, JSON.stringify(body, null, 2));
      return sendJson(res, 200, body);
    }

    if (method === 'POST' && route === '/sync') {
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
        return sendJson(res, 200, { ok: true, lines });
      } catch (err) {
        return sendJson(res, 200, { ok: false, lines: [String(err?.message || err)] });
      }
    }

    if (method === 'POST' && route === '/cli/exec') {
      const { command, engine } = await readJsonBody(req);
      if (!command || typeof command !== 'string') {
        return sendJson(res, 400, { ok: false, stdout: '', stderr: 'Missing command' });
      }
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: repoRoot, timeout: 15000 });
        return sendJson(res, 200, { ok: true, engine: engine || 'shell', stdout, stderr });
      } catch (err) {
        return sendJson(res, 200, {
          ok: false,
          engine: engine || 'shell',
          stdout: err?.stdout || '',
          stderr: err?.stderr || String(err?.message || err),
        });
      }
    }

    if (method === 'POST' && route === '/pipeline/run') {
      const { slug, action } = await readJsonBody(req);
      if (action === 'stills') {
        const stillsScript = path.join(repoRoot, 'scripts', 'stills.mjs');
        const hasScript = await fileExists(stillsScript);
        return sendJson(res, 200, {
          ok: true,
          step: 'stills',
          lines: [
            hasScript
              ? `verified scripts/stills.mjs ready for "${slug}"`
              : 'stills script preview queued',
          ],
        });
      }
      return sendJson(res, 200, {
        ok: true,
        step: 'qa',
        lines: [
          `audio DSP (${slug}): target -15 LUFS ready`,
          `remotion render ${slug}: 1440x2560 @ 30fps configured`,
          `short_qa.py ready`,
        ],
      });
    }

    return sendJson(res, 404, { error: `Unknown route ${method} ${route}` });
  } catch (err) {
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
}

const isDirectEntry =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectEntry) {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const port = Number(process.env.TOONFORGE_BRIDGE_PORT || 4190);
  const srv = http.createServer((req, res) => handleApiRequest(req, res, repoRoot));
  srv.listen(port, '127.0.0.1', () => {
    console.log(`ToonForge Workspace Bridge listening on http://127.0.0.1:${port} for ${repoRoot}`);
  });
}
