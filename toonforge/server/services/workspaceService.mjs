import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ALLOWED_MEDIA_ROOTS = ['out', 'voice', 'audio', path.join('src', 'videos')];

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const TOOL_SPECS = [
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

export async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function listDirSafe(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export function sanitizeSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
}

export function matchVoiceFile(voiceFiles, slug) {
  const slugLower = slug.toLowerCase();
  const shortPrefix = slugLower.replace(/condition$/, '');
  return voiceFiles.find((f) => {
    const low = f.toLowerCase();
    return low.startsWith(`${slugLower}_voice.`) || low.startsWith(`${shortPrefix}_voice.`);
  });
}

async function readCompositionsFromRootTsx(repoRoot) {
  const rootFile = path.join(repoRoot, 'src', 'Root.tsx');
  if (!(await fileExists(rootFile))) return {};
  const src = await fs.readFile(rootFile, 'utf8');
  const importToSlug = {};
  for (const m of src.matchAll(/import\s+\{[^}]*?\b(\w+)\b[^}]*\}\s+from\s+["']\.\/videos\/([^/"']+)\//g)) {
    importToSlug[m[1]] = m[2].toLowerCase();
  }
  const map = {};
  for (const m of src.matchAll(/<Composition\s+id=["']([^"']+)["'][^>]*component=\{(\w+)\}/g)) {
    const slug = importToSlug[m[2]];
    if (slug) map[slug] = m[1];
  }
  return map;
}

export function compositionIdFromSlug(slug, rootMap = {}) {
  const lower = String(slug || '').toLowerCase();
  if (rootMap[lower]) return rootMap[lower];
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
  return known[lower] || `${lower.charAt(0).toUpperCase()}${lower.slice(1)}Short`;
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
      return { id: spec.id, name: spec.name, installed: false, role: spec.role, installCmd: spec.installCmd };
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
    return { id: spec.id, name: spec.name, installed: false, role: spec.role, installCmd: spec.installCmd };
  }
}

// Folder names the claude-animated-shorts skill is installed under (README name, then repo name).
export const SKILL_DIRS = ['cartoon-3d-short', 'claude-animated-shorts'];

export async function probeSkill(home = os.homedir()) {
  const base = { id: 'skill', name: 'claude-animated-shorts skill', role: 'The pipeline, templates and references your agent follows (SKILL.md)', installCmd: 'git clone https://github.com/mromidev/claude-animated-shorts ~/.claude/skills/cartoon-3d-short' };
  for (const dir of SKILL_DIRS) {
    if (await fileExists(path.join(home, '.claude', 'skills', dir, 'SKILL.md'))) {
      return { ...base, installed: true, version: `~/.claude/skills/${dir}` };
    }
  }
  return { ...base, installed: false };
}

export async function getEnvStatus(repoRoot) {
  const probes = await Promise.all([...TOOL_SPECS.map((s) => probeTool(s, repoRoot)), probeSkill()]);
  let branch = 'main';
  try {
    const out = await execFileAsync('git', ['branch', '--show-current'], { cwd: repoRoot, timeout: 2500 });
    if (out.stdout.trim()) branch = out.stdout.trim();
  } catch {
    // Detached HEAD or non-git workspace.
  }
  return { repoRoot, branch, probes };
}

export async function inspectRigs(repoRoot) {
  const chibiRoot = path.join(repoRoot, 'src', 'videos', 'chibi');
  const [sprites, faces, fx] = await Promise.all([
    listDirSafe(path.join(chibiRoot, 'sprites')),
    listDirSafe(path.join(chibiRoot, 'faces')),
    listDirSafe(path.join(chibiRoot, 'fx')),
  ]);
  const filterPng = (arr) => arr.filter((f) => f.toLowerCase().endsWith('.png')).sort();
  const spriteFiles = filterPng(sprites);
  const faceFiles = filterPng(faces);
  const fxFiles = filterPng(fx);
  return {
    stickman: { ready: true, label: 'Built-in Procedural Stickman' },
    chibi: {
      ready: spriteFiles.length > 0 && faceFiles.length > 0,
      sprites: spriteFiles.length,
      faces: faceFiles.length,
      fx: fxFiles.length,
      spriteFiles,
      faceFiles,
      fxFiles,
    },
  };
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

function findMatchingBySlug(files, slugLower, matcher) {
  return files.find((f) => matcher(f.toLowerCase(), slugLower));
}

async function inspectCardArtifacts(repoRoot, card, voiceFiles, audioFiles, scriptFiles, rootMap) {
  const slugLower = card.slug.toLowerCase();
  const shortPrefix = slugLower.replace(/condition$/, '');
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

  const voiceMatch = matchVoiceFile(voiceFiles, slugLower);
  const mixPy = findMatchingBySlug(
    audioFiles,
    slugLower,
    (low) => low === `mix_${slugLower}.py` || low === `mix_${shortPrefix}.py`,
  );
  const mixWav = findMatchingBySlug(
    audioFiles,
    slugLower,
    (low) => low === `mix_${slugLower}.wav` || low === `mix_${shortPrefix}.wav`,
  );
  const scriptMatch = findMatchingBySlug(
    scriptFiles,
    slugLower,
    (low) => low === `script_${slugLower}.md` || low === `script_${shortPrefix}.md`,
  );

  return {
    ...card,
    compositionId: compositionIdFromSlug(card.slug, rootMap),
    voiceFile: voiceMatch || card.voiceFile,
    voicePath: voiceMatch ? `voice/${voiceMatch}` : card.voicePath,
    mixScript: mixPy ? `audio/${mixPy}` : card.mixScript,
    mixWavFile: mixWav ? `audio/${mixWav}` : card.mixWavFile,
    scriptFile: scriptMatch || card.scriptFile,
    videoFile,
    qaReport,
    loudness,
    specs,
    stills: sheetFallback,
  };
}

export async function seedBoardFromWorkspace(repoRoot) {
  const videoDirs = (await listDirSafe(path.join(repoRoot, 'src', 'videos'))).filter((d) => d !== 'chibi');
  const voiceFiles = (await listDirSafe(path.join(repoRoot, 'voice'))).map((f) => f.toLowerCase());
  const rootMap = await readCompositionsFromRootTsx(repoRoot);

  const cards = [];
  for (const slug of videoDirs) {
    const outFiles = await listDirSafe(path.join(repoRoot, 'out', slug));
    const hasMp4 = outFiles.some((f) => f.toLowerCase().endsWith('.mp4'));
    const voiceMatch = matchVoiceFile(voiceFiles, slug);
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
      compositionId: compositionIdFromSlug(slug, rootMap),
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

export async function enrichBoardWithWorkspace(board, repoRoot) {
  const voiceFiles = (await listDirSafe(path.join(repoRoot, 'voice'))).map((f) => f.toLowerCase());
  const audioFiles = await listDirSafe(path.join(repoRoot, 'audio'));
  const rootFiles = await listDirSafe(repoRoot);
  const scriptFiles = rootFiles.filter((f) => /^SCRIPT.*\.md$/i.test(f));
  const rootMap = await readCompositionsFromRootTsx(repoRoot);

  const enriched = [];
  for (const rawCard of board.cards) {
    let card = { ...rawCard };
    const match = matchVoiceFile(voiceFiles, card.slug);
    if (match) {
      card.voiceFile = match;
      if (card.audioMode !== 'no_vo') card.audioMode = 'vo_ready';
      if (board.autoQueue && card.lane === 'backlog') card.lane = 'queued';
    }
    card = await inspectCardArtifacts(repoRoot, card, voiceFiles, audioFiles, scriptFiles, rootMap);
    if (card.loudness && card.lane === 'done') {
      card.durationLabel = card.loudness;
    }
    enriched.push(card);
  }

  return { ...board, cards: enriched };
}

export async function loadAndEnrichBoard(repoRoot) {
  const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
  let board;
  if (await fileExists(boardPath)) {
    board = JSON.parse(await fs.readFile(boardPath, 'utf8'));
  } else {
    board = await seedBoardFromWorkspace(repoRoot);
    await fs.mkdir(path.dirname(boardPath), { recursive: true });
    await fs.writeFile(boardPath, JSON.stringify(board, null, 2));
  }
  return enrichBoardWithWorkspace(board, repoRoot);
}

export async function saveBoard(repoRoot, board) {
  if (!board || typeof board !== 'object' || !Array.isArray(board.cards)) {
    throw new ValidationError('Invalid board payload: cards array required', 400);
  }
  const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
  await fs.mkdir(path.dirname(boardPath), { recursive: true });
  await fs.writeFile(boardPath, JSON.stringify(board, null, 2));
  return board;
}

export async function createCardAndScript(repoRoot, title, rigMode, scriptContent = '') {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    throw new ValidationError('Card title is required', 400);
  }
  const slug = sanitizeSlug(cleanTitle).slice(0, 18) || `short${Date.now()}`;
  const scriptFile = `SCRIPT_${slug.toUpperCase()}.md`;
  const scriptPath = path.join(repoRoot, scriptFile);
  const customScript = typeof scriptContent === 'string' ? scriptContent.trim() : '';
  if (customScript) {
    await fs.writeFile(scriptPath, `${customScript}\n`, 'utf8');
  } else if (!(await fileExists(scriptPath))) {
    const starter = `# ${cleanTitle}\n\n- **Hook (0-3s):** ...\n- **Visual Story:** ...\n- **Punchline + CTA:** Follow for more!\n`;
    await fs.writeFile(scriptPath, starter, 'utf8');
  }

  const boardPath = path.join(repoRoot, '.toonforge', 'board.json');
  const board = (await fileExists(boardPath))
    ? JSON.parse(await fs.readFile(boardPath, 'utf8'))
    : await seedBoardFromWorkspace(repoRoot);

  const rootMap = await readCompositionsFromRootTsx(repoRoot);
  const newCard = {
    id: slug,
    slug,
    title: cleanTitle,
    lane: 'backlog',
    audioMode: 'needs_vo',
    rigMode: rigMode === 'stickman' ? 'stickman' : 'chibi',
    durationLabel: 'Script Ready',
    compositionId: compositionIdFromSlug(slug, rootMap),
    scriptFile,
  };
  const updated = {
    ...board,
    activeLane: 'backlog',
    selectedCardId: newCard.id,
    cards: [newCard, ...board.cards.filter((c) => c.slug !== slug)],
  };
  await saveBoard(repoRoot, updated);
  return enrichBoardWithWorkspace(updated, repoRoot);
}

const MAX_VOICE_BYTES = 12 * 1024 * 1024;
const ALLOWED_VOICE_EXTS = new Set(['.wav', '.mp3']);

/** Saves an uploaded ElevenLabs / creator voiceover file into voice/<slug>_voice.<ext> and auto-queues if enabled. */
export async function saveVoiceoverFile(repoRoot, rawSlug, fileName, base64Data) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    throw new ValidationError('Valid card slug is required', 400);
  }
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (!ALLOWED_VOICE_EXTS.has(ext)) {
    throw new ValidationError('Voiceover file must be .wav or .mp3', 400);
  }
  const cleanB64 = String(base64Data || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .trim();
  if (!cleanB64) {
    throw new ValidationError('Audio payload cannot be empty', 400);
  }
  const buffer = Buffer.from(cleanB64, 'base64');
  if (buffer.length === 0) {
    throw new ValidationError('Decoded audio payload is empty', 400);
  }
  if (buffer.length > MAX_VOICE_BYTES) {
    throw new ValidationError('Voiceover file exceeds 12MB limit', 413);
  }

  const voiceFileName = `${slug}_voice${ext}`;
  const voiceDir = path.join(repoRoot, 'voice');
  await fs.mkdir(voiceDir, { recursive: true });
  await fs.writeFile(path.join(voiceDir, voiceFileName), buffer);

  const board = await loadAndEnrichBoard(repoRoot);
  const cards = board.cards.map((card) => {
    if (card.slug !== slug) return card;
    const lane = board.autoQueue && card.lane === 'backlog' ? 'queued' : card.lane;
    return {
      ...card,
      audioMode: 'vo_ready',
      voiceFile: voiceFileName,
      voicePath: `voice/${voiceFileName}`,
      durationLabel: card.lane === 'done' ? card.durationLabel : 'VO Ready',
      lane,
    };
  });
  const nextBoard = {
    ...board,
    activeLane: board.autoQueue ? 'queued' : board.activeLane,
    selectedCardId: slug,
    cards,
  };
  await saveBoard(repoRoot, nextBoard);
  return enrichBoardWithWorkspace(nextBoard, repoRoot);
}

export async function readCardScript(repoRoot, rawSlug) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) throw new ValidationError('Invalid slug', 400);
  const rootFiles = await listDirSafe(repoRoot);
  const scriptFiles = rootFiles.filter((f) => /^SCRIPT.*\.md$/i.test(f));
  const shortPrefix = slug.replace(/condition$/, '');
  const matched =
    findMatchingBySlug(scriptFiles, slug, (low) => low === `script_${slug}.md` || low === `script_${shortPrefix}.md`) ||
    `SCRIPT_${slug.toUpperCase()}.md`;
  const target = path.join(repoRoot, matched);
  const exists = await fileExists(target);
  const content = exists ? await fs.readFile(target, 'utf8') : '';
  return { slug, file: matched, exists, content };
}

export async function writeCardScript(repoRoot, rawSlug, content) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) throw new ValidationError('Invalid slug', 400);
  if (typeof content !== 'string') {
    throw new ValidationError('Script content must be a string', 400);
  }
  const doc = await readCardScript(repoRoot, slug);
  const target = path.join(repoRoot, doc.file);
  await fs.writeFile(target, content, 'utf8');
  return { slug, file: doc.file, exists: true, content };
}

export async function resolveSafeMediaPath(repoRoot, relPath) {
  const resolvedRoot = path.resolve(repoRoot);
  const normalizedRel = path.normalize(String(relPath || ''));
  const target = path.resolve(resolvedRoot, normalizedRel);
  if (!target.startsWith(resolvedRoot + path.sep)) {
    return null;
  }

  const relativeToRoot = path.relative(resolvedRoot, target);
  const isAllowedDir = ALLOWED_MEDIA_ROOTS.some(
    (prefix) => relativeToRoot === prefix || relativeToRoot.startsWith(prefix + path.sep),
  );
  if (!isAllowedDir) {
    return null;
  }

  if (await fileExists(target)) {
    try {
      const [realRoot, realTarget] = await Promise.all([fs.realpath(resolvedRoot), fs.realpath(target)]);
      if (!realTarget.startsWith(realRoot + path.sep)) return null;
    } catch {
      return null;
    }
  }

  return target;
}
