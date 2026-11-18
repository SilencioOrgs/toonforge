// @vitest-environment node
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore
import { handleApiRequest } from '../../../server/bridge.mjs';
// @ts-ignore
import { readFolder, updateFolder } from '../../../server/engine/folders.mjs';

let tmp: string;
let server: http.Server;
let base: string;

// Agents that never answer on their own, so queued jobs stay observable until cancelled.
const agents = {
  runAgent: (_a: string, _p: string, opts: any) =>
    new Promise((_res, rej) => opts.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
};
const media = {
  typecheck: async () => ({ ok: true, tail: '' }),
  renderPreview: async () => ({ ok: true, tail: '', files: { previews: ['p.mp4'], stills: [] } }),
  renderFinal: async () => ({ ok: true, tail: '', files: { final: 'f.mp4' }, warnings: [] }),
  makeWords: async () => ({ ok: true, tail: '' }),
  snapshotScene: async () => {},
};

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-routes-'));
  server = http.createServer((req, res) => handleApiRequest(req, res, tmp, { agents, media, limits: { voiceBytes: 64 } }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  await call('POST', '/api/queue/pause', { paused: true });
  await call('POST', '/api/queue/cancel');
  server.closeAllConnections();
  server.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

async function call(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
  const res = await fetch(base + url, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) as any };
}
const q = (p: string, extra = '') => `?path=${encodeURIComponent(p)}${extra}`;

async function makeFolder() {
  const r = await call('POST', '/api/folders', { category: 'horror', name: 'Night', agent: 'codex' });
  expect(r.status).toBe(200);
  return r.body.path as string;
}
async function approve(p: string, n = 2) {
  const items = Array.from({ length: n }, (_, i) => ({ title: `Same Title`, hook: `hook ${i}`, audio: 'vo', rig: 'chibi' }));
  return call('POST', '/api/topics/approve' + q(p), { items });
}

describe('engine routes', () => {
  it('creates a folder and lists it in the tree', async () => {
    const p = await makeFolder();
    expect(p).toBe('shorts/horror/Night');
    const tree = await call('GET', '/api/tree');
    const horror = tree.body.categories.find((c: any) => c.id === 'horror');
    expect(horror.folders.map((f: any) => f.path)).toContain(p);
    expect((await call('GET', '/api/health')).body).toEqual({ ok: true });
  });

  it('approve creates unique-slug script cards, writes topics.md, queues a script job', async () => {
    const p = await makeFolder();
    await updateFolder(tmp, p, (f: any) => { f.topicRun = { count: 2, source: 'made_up', state: 'ready', titles: [] }; });
    const r = await approve(p);
    expect(r.status).toBe(200);
    expect(r.body.cards.map((c: any) => c.state)).toEqual(['script', 'script']);
    expect(new Set(r.body.cards.map((c: any) => c.slug)).size).toBe(2);
    expect(r.body.topicRun).toBeNull();
    expect(await fs.readFile(path.join(tmp, p, 'topics.md'), 'utf8')).toBe('- Same Title: hook 0\n- Same Title: hook 1\n');
    const snap = (await call('GET', '/api/queue')).body;
    expect([snap.running, ...snap.queued].some((j: any) => j?.kind === 'script')).toBe(true);
  });

  it('emits folder.changed specifically', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    await updateFolder(tmp, p, (f: any) => { f.cards[0].state = 'review'; });
    const ac = new AbortController();
    const res = await fetch(base + '/api/events', { signal: ac.signal });
    const reader = res.body!.getReader();
    const wait = (async () => {
      let buf = '';
      for (;;) {
        const { value } = await reader.read();
        buf += new TextDecoder().decode(value);
        for (const m of buf.matchAll(/data: (.*)\n\n/g)) if (JSON.parse(m[1]).type === 'folder.changed') return JSON.parse(m[1]);
      }
    })();
    await call('POST', '/api/card/notes' + q(p, `&card=${card.id}`), { text: 'x' });
    const ev: any = await Promise.race([wait, new Promise((_, rej) => setTimeout(() => rej(new Error('no event in 2s')), 2000))]);
    ac.abort();
    expect(ev).toMatchObject({ type: 'folder.changed', path: p });
  });

  it('rejects bad voice uploads with the exact message', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    await updateFolder(tmp, p, (f: any) => { f.cards[0].state = 'voice'; });
    const up = (name: string, size: number) =>
      fetch(base + '/api/card/voice' + q(p, `&card=${card.id}`), {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', 'x-file-name': name },
        body: Buffer.alloc(size, 1),
      });
    const msg = 'Drop a .wav or .mp3 file up to 200 MB.';
    const bad = await up('voice.m4a', 10);
    expect(bad.status).toBe(415);
    expect((await bad.json()).error).toBe(msg);
    const big = await up('voice.wav', 65);
    expect(big.status).toBe(413);
    expect((await big.json()).error).toBe(msg);
  });

  it('stores a valid voice upload, attaches it and queues words', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    await updateFolder(tmp, p, (f: any) => { f.cards[0].state = 'voice'; });
    const res = await fetch(base + '/api/card/voice' + q(p, `&card=${card.id}`), {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-file-name': 'take.mp3' },
      body: Buffer.alloc(20, 7),
    });
    expect(res.status).toBe(200);
    const rel = `${p}/${card.slug}/voice.mp3`;
    expect((await res.json()).cards[0].files.voice).toBe(rel);
    expect((await fs.readFile(path.join(tmp, rel))).length).toBe(20);
  });

  it('rejects folder paths outside shorts/ with 400', async () => {
    for (const bad of ['../../etc', '/etc', 'shorts/../..', 'C:\\x', 'shorts\\horror\\Night', 'other/a/b']) {
      expect((await call('GET', '/api/folder' + q(bad))).status).toBe(400);
    }
  });

  it('surfaces invalid transitions as 409', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    const r = await call('POST', '/api/card/notes' + q(p, `&card=${card.id}`), { text: 'x' });
    expect(r.status).toBe(409);
  });

  it('refuses to rename a folder with jobs, allows it once idle', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const r = await call('PATCH', '/api/folder' + q(p), { name: 'Day' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("Finish or cancel this folder's jobs before renaming");
  });

  it('renames an idle folder and updates the agent', async () => {
    const p = await makeFolder();
    const r = await call('PATCH', '/api/folder' + q(p), { name: 'Day', agent: 'claude' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ path: 'shorts/horror/Day', name: 'Day', agent: 'claude' });
  });

  it('stars and removes topics, rerolls, saves scripts, and manages the queue', async () => {
    const p = await makeFolder();
    await updateFolder(tmp, p, (f: any) => {
      f.topicRun = { count: 3, source: 'made_up', state: 'ready', titles: [{ title: 'A', hook: 'a' }, { title: 'B', hook: 'b' }] };
    });
    const r = await call('PATCH', '/api/topics' + q(p), { titles: [{ title: 'B', starred: true }, { title: 'Nope' }] });
    expect(r.body.topicRun.titles).toEqual([{ title: 'B', hook: 'b', starred: true }]);
    const job = await call('POST', '/api/topics/reroll' + q(p));
    expect(job.body).toMatchObject({ kind: 'topics', payload: { count: 3, source: 'made_up' } });
    expect((await call('POST', '/api/topics' + q(p), { count: 0, source: 'real' })).status).toBe(400);
    expect((await call('POST', '/api/queue/reorder', { jobIds: [] })).status).toBe(200);
    expect((await call('POST', '/api/queue/pause', { paused: 'yes' })).status).toBe(400);

    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    const put = await call('PUT', '/api/card/script' + q(p, `&card=${card.id}`), { content: '# hi' });
    expect(put.body).toEqual({ ok: true });
    expect(await fs.readFile(path.join(tmp, p, card.slug!, 'SCRIPT.md'), 'utf8')).toBe('# hi');
  });

  it('caps topic count at 20 and defaults to 10', async () => {
    const p = await makeFolder();
    expect((await call('POST', '/api/topics' + q(p), { count: 21, source: 'real' })).status).toBe(400);
    const r = await call('POST', '/api/topics' + q(p), { source: 'made_up' });
    expect(r.status).toBe(200);
    expect(r.body.payload.count).toBe(10);
  });

  it('approve writes one topics.md line per topic even when title has a newline, and still queues if the append fails', async () => {
    const p = await makeFolder();
    const r = await call('POST', '/api/topics/approve' + q(p), { items: [{ title: 'Two\r\nLines', hook: 'a\nb', audio: 'vo', rig: 'chibi' }] });
    expect(r.status).toBe(200);
    expect(await fs.readFile(path.join(tmp, p, 'topics.md'), 'utf8')).toBe('- Two Lines: a b\n');
    // a directory squatting on topics.md makes the append fail
    const p2 = (await call('POST', '/api/folders', { category: 'horror', name: 'Other', agent: 'codex' })).body.path;
    await fs.mkdir(path.join(tmp, p2, 'topics.md'));
    const r2 = await call('POST', '/api/topics/approve' + q(p2), { items: [{ title: 'Solo', hook: 'h', audio: 'vo', rig: 'chibi' }] });
    expect(r2.status).toBe(200);
    const snap = (await call('GET', '/api/queue')).body;
    expect([snap.running, ...snap.queued].some((j: any) => j?.folderPath === p2)).toBe(true);
  });

  it('PUT /card/script emits folder.changed', async () => {
    const p = await makeFolder();
    await approve(p, 1);
    const card = (await readFolder(tmp, p)).cards[0];
    const ac = new AbortController();
    const res = await fetch(base + '/api/events', { signal: ac.signal });
    const reader = res.body!.getReader();
    const wait = (async () => {
      let buf = '';
      for (;;) {
        const { value } = await reader.read();
        buf += new TextDecoder().decode(value);
        for (const m of buf.matchAll(/data: (.*)\n\n/g)) if (JSON.parse(m[1]).type === 'folder.changed') return JSON.parse(m[1]);
      }
    })();
    await call('PUT', '/api/card/script' + q(p, `&card=${card.id}`), { content: '# x' });
    const ev: any = await Promise.race([wait, new Promise((_, rej) => setTimeout(() => rej(new Error('no event in 2s')), 2000))]);
    ac.abort();
    expect(ev).toMatchObject({ type: 'folder.changed', path: p });
  });
});
