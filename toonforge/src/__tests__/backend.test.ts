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

  it('GET /api/env probes real installed tools (git, node, cargo, ffmpeg, AI CLIs)', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/env`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      repoRoot: string;
      probes: Array<{ id: string; installed: boolean }>;
    };
    expect(data.repoRoot).toBe(realRepoRoot);
    const git = data.probes.find((p) => p.id === 'git');
    const node = data.probes.find((p) => p.id === 'node');
    expect(git?.installed).toBe(true);
    expect(node?.installed).toBe(true);
    expect(data.probes.some((p) => p.id === 'agy')).toBe(true);
    expect(data.probes.some((p) => p.id === 'claude')).toBe(true);
  });

  it('GET /api/rigs inspects real chibi sprite directories cleanly', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/rigs`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      stickman: { ready: boolean };
      chibi: { sprites: number; faces: number; fx: number };
    };
    expect(data.stickman.ready).toBe(true);
    expect(data.chibi.sprites).toBe(21);
    expect(data.chibi.faces).toBe(16);
    expect(data.chibi.fx).toBe(6);
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
