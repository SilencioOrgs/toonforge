// @vitest-environment node
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../server/bridge.mjs';

const realRepoRoot = path.resolve(import.meta.dirname, '../../..');

async function startTestServer(repoRoot: string) {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (url.startsWith('/api')) {
      req.url = url.replace(/^\/api/, '') || '/';
      await handleApiRequest(req, res, repoRoot);
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

describe('Node Workspace Bridge API (Tauri parity layer)', () => {
  let realSrv: Awaited<ReturnType<typeof startTestServer>>;
  let tmpDir: string;
  let tmpSrv: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    realSrv = await startTestServer(realRepoRoot);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toonforge-test-'));
    await fs.mkdir(path.join(tmpDir, 'voice'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src', 'videos', 'dbindex'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'voice', 'dbindex_voice.wav'), 'RIFF');
    tmpSrv = await startTestServer(tmpDir);
  });

  afterAll(async () => {
    realSrv.server.close();
    tmpSrv.server.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/env probes video creation tools with clear roles (git, node, python, py_deps, ffmpeg, AI CLIs)', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/env`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      repoRoot: string;
      probes: Array<{ id: string; installed: boolean; role?: string }>;
    };
    expect(data.repoRoot).toBe(realRepoRoot);
    const git = data.probes.find((p) => p.id === 'git');
    const node = data.probes.find((p) => p.id === 'node');
    const pyDeps = data.probes.find((p) => p.id === 'py_deps');
    expect(git?.installed).toBe(true);
    expect(node?.installed).toBe(true);
    expect(pyDeps?.role).toMatch(/numpy|pillow|QA/i);
    expect(data.probes.some((p) => p.id === 'chromium')).toBe(true);
    expect(data.probes.some((p) => p.id === 'agy')).toBe(true);
    expect(data.probes.some((p) => p.id === 'claude')).toBe(true);
  });

  it('GET /api/board against real repo enriches cards with real script, voice, audio mix, QA loudness, and video paths', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/board`);
    expect(res.status).toBe(200);
    const board = (await res.json()) as {
      cards: Array<{
        slug: string;
        compositionId: string;
        audioMode: string;
        scriptFile?: string;
        voicePath?: string;
        mixWavFile?: string;
        loudness?: string;
        videoFile?: string;
        stills?: string[];
      }>;
    };
    const binary = board.cards.find((c) => c.slug === 'binary');
    expect(binary).toBeDefined();
    expect(binary?.compositionId).toBe('BinaryShort');
    expect(binary?.scriptFile).toBe('SCRIPT_BINARY.md');
    expect(binary?.voicePath).toBe('voice/binary_voice.wav');
    expect(binary?.mixWavFile).toBe('audio/mix_binary.wav');
    expect(binary?.videoFile).toContain('out/binary/');
    expect(binary?.loudness).toContain('-15.1 LUFS');
    expect(binary?.stills?.length).toBeGreaterThan(0);

    const dbindex = board.cards.find((c) => c.slug === 'dbindex');
    expect(dbindex?.compositionId).toBe('DbIndexShort');
    const race = board.cards.find((c) => c.slug === 'racecondition');
    expect(race?.compositionId).toBe('RaceConditionShort');
    expect(race?.audioMode).toBe('vo_ready');
    expect(race?.voicePath).toBe('voice/race_voice.wav');
  });

  it('rejects cross-origin simple CSRF, blocks non-media repo files, handles invalid Range/dir streams safely, and validates script writes', async () => {
    const csrfRes = await fetch(`${realSrv.baseUrl}/api/cli/exec`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'content-type': 'text/plain' },
      body: JSON.stringify({ command: 'echo pwned' }),
    });
    expect([403, 415]).toContain(csrfRes.status);

    const plainRes = await fetch(`${realSrv.baseUrl}/api/cli/exec`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ command: 'echo blocked' }),
    });
    expect(plainRes.status).toBe(415);

    const pkgRes = await fetch(`${realSrv.baseUrl}/api/media?path=${encodeURIComponent('package.json')}`);
    expect(pkgRes.status).toBe(403);

    const dirRes = await fetch(`${realSrv.baseUrl}/api/media?path=${encodeURIComponent('out')}`);
    expect(dirRes.status).toBe(404);

    const badRange = await fetch(`${realSrv.baseUrl}/api/media?path=${encodeURIComponent('src/videos/chibi/sprites/idle.png')}`, {
      headers: { Range: 'bytes=999999999-' },
    });
    expect(badRange.status).toBe(416);

    const badPut = await fetch(`${tmpSrv.baseUrl}/api/script`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'dbindex' }),
    });
    expect(badPut.status).toBe(400);

    const missingQa = await fetch(`${tmpSrv.baseUrl}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'dbindex', action: 'render' }),
    });
    const qaData = (await missingQa.json()) as { ok: boolean; lines: string[] };
    expect(qaData.ok).toBe(false);
    expect(qaData.lines.join(' ')).toContain('DbIndexShort');
  });

  it('GET and PUT /api/script read and write workspace SCRIPT_*.md files safely', async () => {
    const readRes = await fetch(`${realSrv.baseUrl}/api/script?slug=binary`);
    expect(readRes.status).toBe(200);
    const doc = (await readRes.json()) as { file: string; exists: boolean; content: string };
    expect(doc.file).toBe('SCRIPT_BINARY.md');
    expect(doc.exists).toBe(true);
    expect(doc.content.length).toBeGreaterThan(20);

    const writeRes = await fetch(`${tmpSrv.baseUrl}/api/script`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'dbindex', content: '# Updated DbIndex Script\nHook line!' }),
    });
    expect(writeRes.status).toBe(200);
    const saved = await fs.readFile(path.join(tmpDir, 'SCRIPT_DBINDEX.md'), 'utf8');
    expect(saved).toContain('Updated DbIndex Script');
  });

  it('POST /api/cards creates a real SCRIPT_<SLUG>.md and GET /api/media streams safe paths', async () => {
    const createRes = await fetch(`${tmpSrv.baseUrl}/api/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cache Stampede', rigMode: 'stickman' }),
    });
    expect(createRes.status).toBe(200);
    const updatedBoard = (await createRes.json()) as { cards: Array<{ slug: string; scriptFile?: string }> };
    const created = updatedBoard.cards.find((c) => c.slug === 'cachestampede');
    expect(created).toBeDefined();
    const mdText = await fs.readFile(path.join(tmpDir, created!.scriptFile!), 'utf8');
    expect(mdText).toContain('Cache Stampede');

    const imgRes = await fetch(`${realSrv.baseUrl}/api/media?path=${encodeURIComponent('src/videos/chibi/sprites/idle.png')}`);
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers.get('content-type')).toContain('image/png');

    const badRes = await fetch(`${realSrv.baseUrl}/api/media?path=${encodeURIComponent('../package.json')}`);
    expect(badRes.status).toBe(403);
  });

  it('GET /api/rigs inspects real chibi sprite directories and lists PNG asset names cleanly', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/rigs`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      stickman: { ready: boolean };
      chibi: { sprites: number; faces: number; fx: number; spriteFiles?: string[]; faceFiles?: string[]; fxFiles?: string[] };
    };
    expect(data.stickman.ready).toBe(true);
    expect(data.chibi.sprites).toBe(21);
    expect(data.chibi.faces).toBe(16);
    expect(data.chibi.fx).toBe(6);
    expect(data.chibi.spriteFiles).toContain('idle.png');
    expect(data.chibi.faceFiles?.length).toBe(16);
    expect(data.chibi.fxFiles?.length).toBe(6);
  });

  it('GET and POST /api/board initialize and persist .toonforge/board.json', async () => {
    const res1 = await fetch(`${tmpSrv.baseUrl}/api/board`);
    expect(res1.status).toBe(200);
    const board = (await res1.json()) as { autoQueue: boolean; cards: Array<{ slug: string }> };
    expect(Array.isArray(board.cards)).toBe(true);
    expect(board.cards.some((c) => c.slug === 'dbindex')).toBe(true);

    const updated = { ...board, autoQueue: false };
    const res2 = await fetch(`${tmpSrv.baseUrl}/api/board`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updated),
    });
    expect(res2.status).toBe(200);

    const savedRaw = await fs.readFile(path.join(tmpDir, '.toonforge', 'board.json'), 'utf8');
    expect(JSON.parse(savedRaw).autoQueue).toBe(false);
  });

  it('POST /api/cli/exec runs workspace commands and returns stdout', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/cli/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'agy', command: 'node -e "console.log(\'toonforge-ok\')"' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; stdout: string };
    expect(data.ok).toBe(true);
    expect(data.stdout).toContain('toonforge-ok');
  });
});
