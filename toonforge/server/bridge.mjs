import { exec, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const TOOL_SPECS = [
  {
    id: 'git',
    name: 'Git',
    bin: 'git',
    args: ['--version'],
    role: 'Clones & syncs your ToonForge template repository',
    installCmd: 'winget install Git.Git',
  },
  {
    id: 'node',
    name: 'Node.js (>=20)',
    bin: 'node',
    args: ['-v'],
    role: 'Bundles TypeScript & renders Three.js/Remotion scenes',
    installCmd: 'winget install OpenJS.NodeJS.LTS',
  },
  {
    id: 'python',
    name: 'Python (>=3.10)',
    bin: 'python',
    args: ['--version'],
    role: 'Executes VO sync, -15 LUFS DSP audio mix & frame QA',
    installCmd: 'winget install Python.Python.3.12',
  },
  {
    id: 'py_deps',
    name: 'NumPy + Pillow',
    bin: 'python',
    args: ['-c', 'import numpy, PIL; print("numpy+pillow OK")'],
    role: 'Analyzes frame luma, black frames & contact sheets (short_qa.py)',
    installCmd: 'python -m pip install numpy pillow',
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg + FFprobe',
    bin: 'ffmpeg',
    args: ['-version'],
    role: 'Normalizes -15 LUFS audio & encodes/analyzes MP4 streams',
    installCmd: 'winget install Gyan.FFmpeg',
  },
  {
    id: 'chromium',
    name: 'Chromium / Chrome',
    bin: 'chromium',
    chromiumCheck: true,
    role: 'Headless WebGL browser engine used by Remotion to render MP4 frames',
    installCmd: 'npx remotion browser ensure',
  },
  {
    id: 'agy',
    name: 'Antigravity CLI',
    bin: 'agy',
    args: ['--version'],
    whereOnly: true,
    role: 'Built-in IDE coding agent (no external API key needed)',
    installCmd: 'Bundled with Antigravity IDE',
  },
  {
    id: 'claude',
    name: 'Claude Code CLI',
    bin: 'claude',
    args: ['--version'],
    whereOnly: true,
    role: 'Anthropic CLI agent (requires Claude Pro/Max or API key)',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    bin: 'codex',
    args: ['--version'],
    whereOnly: true,
    role: 'OpenAI CLI agent (requires ChatGPT Plus/Pro or OPENAI_API_KEY)',
    installCmd: 'npm install -g @openai/codex',
  },
  {
    id: 'opencode',
    name: 'OpenCode CLI',
    bin: 'opencode',
    args: ['--version'],
    whereOnly: true,
    role: 'Open-source BYOK CLI agent (Gemini / OpenRouter / Ollama)',
    installCmd: 'npm install -g opencode-ai',
  },
];

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function probeChromium(repoRoot) {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const c of candidates) {
    if (await fileExists(c)) {
      return { id: 'chromium', name: 'Chromium / Chrome', installed: true, version: path.basename(c) };
    }
  }
  const remotionCache = path.join(repoRoot, 'node_modules', '.remotion');
  if (await fileExists(remotionCache)) {
    return { id: 'chromium', name: 'Chromium / Chrome', installed: true, version: 'remotion cache' };
  }
  return { id: 'chromium', name: 'Chromium / Chrome', installed: false };
}

async function probeTool(spec, repoRoot) {
  if (spec.chromiumCheck) {
    const res = await probeChromium(repoRoot);
    return { ...res, role: spec.role, installCmd: spec.installCmd };
  }
  if (spec.whereOnly) {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    try {
      const { stdout } = await execFileAsync(cmd, [spec.bin], { timeout: 2500 });
      const line = stdout.trim().split(/\r?\n/)[0];
      return {
        id: spec.id,
        name: spec.name,
        installed: Boolean(line),
        version: line ? 'PATH ready' : undefined,
        role: spec.role,
        installCmd: spec.installCmd,
      };
    } catch {
      return {
        id: spec.id,
        name: spec.name,
        installed: false,
        role: spec.role,
        installCmd: spec.installCmd,
      };
    }
  }
  try {
    const { stdout, stderr } = await execFileAsync(spec.bin, spec.args, { timeout: 3000 });
    const firstLine = `${stdout}\n${stderr}`.trim().split(/\r?\n/)[0]?.slice(0, 48);
    return {
      id: spec.id,
      name: spec.name,
      installed: Boolean(firstLine),
      version: firstLine || 'ok',
      role: spec.role,
      installCmd: spec.installCmd,
    };
  } catch {
    return {
      id: spec.id,
      name: spec.name,
      installed: false,
      role: spec.role,
      installCmd: spec.installCmd,
    };
  }
}

async function listDirSafe(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
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

function compositionIdFromSlug(slug) {
  const known = {
    dbindex: 'DbIndexShort',
    redis: 'RedisShort',
    binary: 'BinaryShort',
    idor: 'IdorShort',
    ratelimit: 'RateLimitShort',
    racecondition: 'RaceConditionShort',
    sqli: 'SqliShort',
    notopax: 'NoToPaxSilicaShort',
    paxsilica: 'PaxSilicaShort',
  };
  return known[slug] || `${slug.charAt(0).toUpperCase()}${slug.slice(1)}Short`;
}

async function inspectCardArtifacts(repoRoot, card, voiceFiles, mixFiles, scriptFiles) {
  const slugLower = card.slug.toLowerCase();
  const outDir = path.join(repoRoot, 'out', card.slug);
  const outFiles = await listDirSafe(outDir);
  const mp4s = outFiles.filter((f) => f.toLowerCase().endsWith('.mp4'));
  const preferredMp4 =
    mp4s.find((f) => f.includes('_2k')) || mp4s.find((f) => f.includes('chibi')) || mp4s[0];
  const videoFile = preferredMp4 ? `out/${card.slug}/${preferredMp4}` : undefined;

  const qaReportPath = path.join(outDir, 'qa', 'report.md');
  let specs;
  let loudness;
  let qaReport;
  if (await fileExists(qaReportPath)) {
    qaReport = `out/${card.slug}/qa/report.md`;
    const reportText = await fs.readFile(qaReportPath, 'utf8');
    const specsLine = reportText.split(/\r?\n/).find((l) => l.startsWith('SPECS '));
    const loudLine = reportText.split(/\r?\n/).find((l) => l.startsWith('LOUDNESS '));
    if (specsLine) specs = specsLine.replace(/^SPECS\s+/, '').trim();
    if (loudLine) {
      const m = loudLine.match(/I:\s*([-+]?\d+(?:\.\d+)?\s*LUFS)/i);
      loudness = m ? m[1] : loudLine.replace(/^LOUDNESS\s+/, '').slice(0, 32);
    }
  }

  const stillsDir = path.join(outDir, 'stills');
  const qaDir = path.join(outDir, 'qa');
  const stillsList = (await listDirSafe(stillsDir))
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .slice(0, 6)
    .map((f) => `out/${card.slug}/stills/${f}`);
  const sheetFallback =
    stillsList.length > 0
      ? stillsList
      : (await listDirSafe(qaDir))
          .filter((f) => /^sheet_.*\.(png|jpe?g)$/i.test(f))
          .slice(0, 4)
          .map((f) => `out/${card.slug}/qa/${f}`);

  const voiceMatch = voiceFiles.find((f) => f.startsWith(`${slugLower}_voice.`));
  const mixMatch = mixFiles.find((f) => f === `mix_${slugLower}.py`);
  const scriptMatch = scriptFiles.find((f) => f.toLowerCase() === `script_${slugLower}.md`);

  return {
    ...card,
    compositionId: card.compositionId || compositionIdFromSlug(card.slug),
    voiceFile: voiceMatch || card.voiceFile,
    mixScript: mixMatch ? `audio/${mixMatch}` : undefined,
    scriptFile: scriptMatch || card.scriptFile,
    videoFile,
    qaReport,
    loudness,
    specs,
    stills: sheetFallback,
  };
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
      compositionId: compositionIdFromSlug(slug),
      voiceFile: voiceMatch,
    });
  }

  const preferred = cards.find((c) => c.slug === 'dbindex') || cards.find((c) => c.lane === 'queued') || cards[0];
  return {
    version: 1,
    autoQueue: true,
    activeLane: preferred ? preferred.lane : 'backlog',
    selectedCardId: preferred ? preferred.id : '',
    cards,
  };
}

async function enrichBoardWithWorkspace(board, repoRoot) {
  const voiceFiles = (await listDirSafe(path.join(repoRoot, 'voice'))).map((f) => f.toLowerCase());
  const mixFiles = await listDirSafe(path.join(repoRoot, 'audio'));
  const rootFiles = await listDirSafe(repoRoot);
  const scriptFiles = rootFiles.filter((f) => /^SCRIPT.*\.md$/i.test(f));

  const enriched = [];
  for (const rawCard of board.cards) {
    let card = { ...rawCard };
    const match = voiceFiles.find((f) => f.startsWith(`${card.slug.toLowerCase()}_voice.`));
    if (match) {
      card.voiceFile = match;
      if (card.audioMode !== 'no_vo') card.audioMode = 'vo_ready';
      if (board.autoQueue && card.lane === 'backlog') card.lane = 'queued';
    }
    card = await inspectCardArtifacts(repoRoot, card, voiceFiles, mixFiles, scriptFiles);
    if (card.loudness && card.lane === 'done') {
      card.durationLabel = card.loudness;
    }
    enriched.push(card);
  }

  return { ...board, cards: enriched };
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

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.md': 'text/markdown; charset=utf-8',
};

/** Handles workspace API routes shared by Vite dev middleware and standalone Node server. */
export async function handleApiRequest(req, res, repoRoot) {
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const route = parsedUrl.pathname.startsWith('/api')
    ? parsedUrl.pathname.slice(4) || '/'
    : parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET' && route === '/env') {
      const probes = await Promise.all(TOOL_SPECS.map((s) => probeTool(s, repoRoot)));
      let branch = 'main';
      try {
        const out = await execFileAsync('git', ['branch', '--show-current'], { cwd: repoRoot, timeout: 2500 });
        if (out.stdout.trim()) branch = out.stdout.trim();
      } catch {
        // Folder not initialized with commits yet.
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
      board = await enrichBoardWithWorkspace(board, repoRoot);
      return sendJson(res, 200, board);
    }

    if (method === 'POST' && route === '/board') {
      const body = await readJsonBody(req);
      const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
      await fs.mkdir(path.dirname(boardPath), { recursive: true });
      await fs.writeFile(boardPath, JSON.stringify(body, null, 2));
      return sendJson(res, 200, body);
    }

    if (method === 'POST' && route === '/cards') {
      const { title, rigMode } = await readJsonBody(req);
      const cleanTitle = String(title || 'Untitled Short').trim();
      const slug =
        cleanTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 18) || `short${Date.now()}`;
      const scriptFile = `SCRIPT_${slug.toUpperCase()}.md`;
      const scriptPath = path.join(repoRoot, scriptFile);
      if (!(await fileExists(scriptPath))) {
        const starter = `# ${cleanTitle}\n\n- **Hook (0-3s):** ...\n- **Visual Story:** ...\n- **Punchline + CTA:** Follow for more!\n`;
        await fs.writeFile(scriptPath, starter, 'utf8');
      }

      const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
      let board = (await fileExists(boardPath))
        ? JSON.parse(await fs.readFile(boardPath, 'utf8'))
        : await seedBoardFromWorkspace(repoRoot);

      const newCard = {
        id: slug,
        slug,
        title: cleanTitle,
        lane: 'backlog',
        audioMode: 'needs_vo',
        rigMode: rigMode === 'stickman' ? 'stickman' : 'chibi',
        durationLabel: 'Script Ready',
        compositionId: compositionIdFromSlug(slug),
        scriptFile,
      };
      board = {
        ...board,
        activeLane: 'backlog',
        selectedCardId: newCard.id,
        cards: [newCard, ...board.cards.filter((c) => c.slug !== slug)],
      };
      await fs.mkdir(path.dirname(boardPath), { recursive: true });
      await fs.writeFile(boardPath, JSON.stringify(board, null, 2));
      return sendJson(res, 200, await enrichBoardWithWorkspace(board, repoRoot));
    }

    if (method === 'GET' && route === '/media') {
      const rel = parsedUrl.searchParams.get('path') || '';
      const resolvedRoot = path.resolve(repoRoot);
      const target = path.resolve(repoRoot, rel);
      if (!target.startsWith(resolvedRoot + path.sep)) {
        return sendJson(res, 403, { error: 'Forbidden path' });
      }
      if (!(await fileExists(target))) {
        return sendJson(res, 404, { error: 'File not found' });
      }
      const stat = await fs.stat(target);
      const ext = path.extname(target).toLowerCase();
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      const range = req.headers.range;
      res.setHeader('Content-Type', mime);
      res.setHeader('Accept-Ranges', 'bytes');

      if (range && range.startsWith('bytes=')) {
        const [startStr, endStr] = range.replace('bytes=', '').split('-');
        const start = Number(startStr) || 0;
        const end = endStr ? Math.min(Number(endStr), stat.size - 1) : stat.size - 1;
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        createReadStream(target, { start, end }).pipe(res);
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Length', String(stat.size));
      createReadStream(target).pipe(res);
      return;
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
      const outDir = path.join(repoRoot, 'out', slug || '');
      if (action === 'stills') {
        const stillsFiles = await listDirSafe(path.join(outDir, 'stills'));
        const qaSheets = await listDirSafe(path.join(outDir, 'qa'));
        const count = stillsFiles.length || qaSheets.filter((f) => f.startsWith('sheet_')).length;
        return sendJson(res, 200, {
          ok: true,
          step: 'stills',
          lines: [
            count > 0
              ? `found ${count} real still/contact images in out/${slug}`
              : `no stills yet in out/${slug}/stills — run node scripts/stills.mjs after scene build`,
          ],
        });
      }

      const qaPath = path.join(outDir, 'qa', 'report.md');
      if (await fileExists(qaPath)) {
        const report = await fs.readFile(qaPath, 'utf8');
        const lines = report.trim().split(/\r?\n/).slice(0, 6);
        return sendJson(res, 200, { ok: true, step: 'qa', lines });
      }
      return sendJson(res, 200, {
        ok: true,
        step: 'qa',
        lines: [
          `audio/mix_${slug}.py -> target -15 LUFS`,
          `remotion render -> out/${slug}/${slug}_2k.mp4`,
          `python scripts/short_qa.py out/${slug}/${slug}_2k.mp4 out/${slug}/qa`,
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
