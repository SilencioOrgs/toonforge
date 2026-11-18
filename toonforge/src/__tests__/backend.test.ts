// @vitest-environment node
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../server/bridge.mjs';
import { installCommand } from '../../server/services/jobRunner.mjs';
import { probeSkill } from '../../server/services/workspaceService.mjs';

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

  beforeAll(async () => {
    realSrv = await startTestServer(realRepoRoot);
  });

  afterAll(async () => {
    realSrv.server.close();
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
    expect(data.probes.some((p) => p.id === 'skill')).toBe(true);
  }, 30000);

  it('rejects cross-origin simple CSRF, blocks non-media repo files, handles invalid Range/dir streams safely', async () => {
    const csrfRes = await fetch(`${realSrv.baseUrl}/api/tools/install`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'content-type': 'text/plain' },
      body: JSON.stringify({ command: 'echo pwned' }),
    });
    expect([403, 415]).toContain(csrfRes.status);

    const plainRes = await fetch(`${realSrv.baseUrl}/api/tools/install`, {
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
  });

  it('GET /api/media streams safe paths', async () => {
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

  it('POST /api/tools/install only runs installers from the fixed server-side list', async () => {
    const res = await fetch(`${realSrv.baseUrl}/api/tools/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'rm -rf /' }),
    });
    expect(res.status).toBe(400);
    expect(installCommand('claude')).toBe('npm install -g @anthropic-ai/claude-code');
    expect(installCommand('git', 'win32')).toMatch(/^winget install -e --id Git\.Git /);
    expect(installCommand('git', 'linux')).toBeUndefined();
    expect(installCommand('toString')).toBeUndefined();
  });

  it('probeSkill finds SKILL.md under either install folder name', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'toonforge-home-'));
    try {
      expect((await probeSkill(home)).installed).toBe(false);
      await fs.mkdir(path.join(home, '.claude', 'skills', 'claude-animated-shorts'), { recursive: true });
      await fs.writeFile(path.join(home, '.claude', 'skills', 'claude-animated-shorts', 'SKILL.md'), '# skill');
      const probe = await probeSkill(home);
      expect(probe).toMatchObject({ id: 'skill', installed: true, version: '~/.claude/skills/claude-animated-shorts' });
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
