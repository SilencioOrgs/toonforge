// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// @ts-ignore
import { createFolder, readFolder, updateFolder } from '../../../server/engine/folders.mjs';
// @ts-ignore
import { newCard, retry } from '../../../server/engine/cardMachine.mjs';
// @ts-ignore
import { snapshotScene } from '../../../server/engine/media.mjs';
// @ts-ignore
import { createBus } from '../../../server/engine/events.mjs';
// @ts-ignore
import { createQueue } from '../../../server/engine/queue.mjs';

const REL = 'shorts/horror/Night';
let tmp: string;
let q: any;
let bus: any;

function deferred<T = any>() {
  let resolve!: (v: T) => void, reject!: (e: any) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const okRun = (text = 'done') => ({ ok: true, events: [{ type: 'done', ok: true, text }], tail: '' });

/** Fake runAgent: records calls, tracks concurrency, rejects on abort. `respond` defaults to a gate the test resolves. */
function fakeAgent(respond?: (call: any) => any) {
  const calls: any[] = [];
  const gates: ReturnType<typeof deferred>[] = [];
  const waiters: (() => void)[] = [];
  const s = { active: 0, max: 0 };
  const runAgent = async (agent: string, prompt: string, opts: any) => {
    const call = { agent, prompt, opts };
    calls.push(call);
    waiters.splice(0).forEach((w) => w());
    s.active++;
    s.max = Math.max(s.max, s.active);
    try {
      return await new Promise((res, rej) => {
        opts.signal?.addEventListener('abort', () => rej(new Error('aborted')));
        const r = respond ? respond(call) : (gates.push(deferred()), gates.at(-1)!.promise);
        // Like the real runAgent, stream every event through onEvent.
        Promise.resolve(r).then((out: any) => { out?.events?.forEach((e: any) => opts.onEvent?.(e)); res(out); }, rej);
      });
    } finally {
      s.active--;
    }
  };
  const called = async (n: number) => {
    while (calls.length < n) await new Promise<void>((r) => waiters.push(r));
    return calls[n - 1];
  };
  return { runAgent, calls, gates, called, s };
}

function fakeMedia() {
  return {
    typecheck: vi.fn(async () => ({ ok: true, tail: '' })),
    renderPreview: vi.fn(async () => ({ ok: true, tail: '', files: { previews: ['p.mp4'], stills: [] } })),
    renderFinal: vi.fn(async () => ({ ok: true, tail: '', files: { final: 'f.mp4' }, warnings: [] })),
    makeWords: vi.fn(async () => ({ ok: true, tail: '' })),
    snapshotScene: vi.fn(async () => {}),
  };
}

const next = (type: string, pred: (e: any) => boolean = () => true) =>
  new Promise<any>((res) => {
    const un = bus.subscribe((e: any) => { if (e.type === type && pred(e)) { un(); res(e); } });
  });

async function addCard(slug: string, patch: any = {}) {
  const card = { ...newCard({ title: `T ${slug}`, hook: 'h', audio: 'vo', rig: 'chibi', slug, compId: slug.toUpperCase() }), ...patch };
  card.files = { ...card.files, ...(patch.files ?? {}) };
  await updateFolder(tmp, REL, (f: any) => { f.cards.push(card); });
  return card;
}
const cardOf = async (id: string): Promise<any> => (await readFolder(tmp, REL)).cards.find((c: any) => c.id === id);
async function writeScript(slug: string) {
  await fs.mkdir(path.join(tmp, REL, slug), { recursive: true });
  await fs.writeFile(path.join(tmp, REL, slug, 'SCRIPT.md'), '# s');
}

function makeQueue(agent: ReturnType<typeof fakeAgent>, media = fakeMedia()) {
  q = createQueue({ repoRoot: tmp, bus, agents: { runAgent: agent.runAgent }, media } as any);
  return media;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-queue-'));
  await createFolder(tmp, { category: 'horror', name: 'Night', agent: 'codex' });
  bus = createBus();
  q = null;
});
afterEach(async () => {
  if (q) { q.setPaused(true); await q.cancel(); }
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('job queue', () => {
  it('runs one job at a time', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const cards = [];
    for (const s of ['a', 'b', 'c']) { cards.push(await addCard(s)); await writeScript(s); }
    for (const c of cards) await q.enqueueCard(REL, c.id);
    for (let i = 1; i <= 3; i++) {
      await agent.called(i);
      expect(agent.s.active).toBe(1);
      const done = next('job.finished');
      agent.gates[i - 1].resolve(okRun(`script ${i}`));
      expect((await done).ok).toBe(true);
    }
    expect(agent.s.max).toBe(1);
    const a = await cardOf(cards[0].id);
    expect(a.state).toBe('voice');
    expect(a.files.script).toBe(`${REL}/a/SCRIPT.md`);
    expect(a.history).toHaveLength(1);
    expect(a.history[0]).toMatchObject({ step: 'script', agent: 'codex', ok: true, summary: 'script 1' });
    expect(a.history[0].logFile).toMatch(/^out\/a\/logs\/script-[0-9T-]+Z\.jsonl$/);
    const log = await fs.readFile(path.join(tmp, a.history[0].logFile), 'utf8');
    expect(log).toContain('script 1');
  });

  it('render jumps ahead', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const x = await addCard('x');
    const a = await addCard('a', { state: 'scene' });
    const b = await addCard('b', { state: 'scene' });
    const c = await addCard('c', { state: 'render' });
    await q.enqueueCard(REL, x.id);
    await agent.called(1);
    await q.enqueueCard(REL, a.id);
    await q.enqueueCard(REL, b.id);
    await q.enqueueCard(REL, c.id);
    const snap = q.snapshot();
    expect(snap.running.cardId).toBe(x.id);
    expect(snap.queued.map((j: any) => [j.kind, j.cardId])).toEqual([['render', c.id], ['scene', a.id], ['scene', b.id]]);
  });

  it('auto-fix twice then fail', async () => {
    const agent = fakeAgent(() => okRun('built'));
    const media = fakeMedia();
    media.typecheck.mockImplementation(async () => ({ ok: false, tail: 'TS2322: bad type' }));
    makeQueue(agent, media);
    const card = await addCard('s', { state: 'scene' });
    const attempts: number[] = [];
    bus.subscribe((e: any) => { if (e.type === 'queue.changed' && e.queue.running) attempts.push(e.queue.running.attempt); });
    const done = next('job.finished');
    await q.enqueueCard(REL, card.id);
    expect((await done).ok).toBe(false);
    expect(agent.calls).toHaveLength(3);
    expect(agent.calls[1].prompt).toContain('The engine check after scene failed:');
    expect(agent.calls[2].prompt).toContain('TS2322: bad type');
    expect(Math.max(...attempts)).toBe(3);
    const c = await cardOf(card.id);
    expect(c).toMatchObject({ state: 'failed', failedStep: 'scene' });
    expect(c.error).toContain('TS2322');
    expect(c.history[0].ok).toBe(false);
  });

  it('agent missing fails fast', async () => {
    const agent = fakeAgent(() => Promise.reject(Object.assign(new Error('spawn codex ENOENT'), { code: 'AGENT_MISSING' })));
    makeQueue(agent);
    const card = await addCard('m');
    const done = next('job.finished');
    await q.enqueueCard(REL, card.id);
    expect((await done).error).toBe('Codex is not installed or not on PATH.');
    expect(agent.calls).toHaveLength(1);
    expect(await cardOf(card.id)).toMatchObject({ state: 'failed', failedStep: 'script', error: 'Codex is not installed or not on PATH.' });
  });

  it('interrupted on start', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const card = await addCard('i', { state: 'sound' });
    await q.start();
    expect(await cardOf(card.id)).toMatchObject({ state: 'failed', failedStep: 'sound', error: 'Interrupted when ToonForge closed' });
  });

  it('start enqueues pending word timings but not imported cards', async () => {
    const agent = fakeAgent();
    const media = makeQueue(agent);
    const a = await addCard('a', { state: 'voice', files: { voice: `${REL}/a/voice.wav` } });
    const b = await addCard('b', { state: 'voice', imported: true, files: { voice: `${REL}/b/voice.wav` } });
    const done = next('job.finished');
    await q.start();
    expect((await done).job.cardId).toBe(a.id);
    expect(media.makeWords).toHaveBeenCalledTimes(1);
    expect(media.makeWords.mock.calls[0].slice(0, 3)).toEqual([tmp, `${REL}/a/voice.wav`, `${REL}/a/words.json`]);
    expect(await cardOf(a.id)).toMatchObject({ state: 'scene', files: { words: `${REL}/a/words.json` } });
    expect((await cardOf(b.id)).state).toBe('voice');
  });

  it('revision snapshots', async () => {
    const order: string[] = [];
    const agent = fakeAgent(() => { order.push('agent'); return new Promise(() => {}); });
    const media = makeQueue(agent);
    media.snapshotScene.mockImplementation(async () => { order.push('snapshot'); });
    const card = await addCard('r', {
      state: 'scene',
      notes: [{ at: 'x', text: 'bigger hero', previewVersion: 1 }],
      files: { previews: ['out/r/preview-v1.mp4'], stills: ['out/r/stills/v1_10.jpg'] },
    });
    await q.enqueueCard(REL, card.id);
    const call = await agent.called(1);
    expect(media.snapshotScene).toHaveBeenCalledWith(tmp, 'r', 2);
    expect(order).toEqual(['snapshot', 'agent']);
    expect(call.prompt).toContain('per this note: bigger hero');
    expect(call.prompt).toContain('out/r/stills/v1_10.jpg');
  });

  it('topics retry then error', async () => {
    const agent = fakeAgent(() => okRun('Here are some thoughts, no list.'));
    makeQueue(agent);
    const done = next('job.finished');
    await q.enqueueTopics(REL, { count: 3, source: 'made_up', exclude: [] });
    expect((await done).ok).toBe(false);
    expect(agent.calls).toHaveLength(2);
    const f = await readFolder(tmp, REL);
    expect(f.topicRun).toMatchObject({ state: 'error', count: 3, source: 'made_up', error: 'Agent did not return a topic list' });
    const logs = await fs.readdir(path.join(tmp, REL, 'logs'));
    expect(logs[0]).toMatch(/^topics-.*\.jsonl$/);
  });

  it('topics keeps starred', async () => {
    await updateFolder(tmp, REL, (f: any) => {
      f.agent = 'claude';
      f.topicRun = { count: 3, source: 'real', state: 'ready', titles: [{ title: 'Kept', hook: 'k', starred: true }, { title: 'Dropped', hook: 'd' }] };
    });
    const reply = JSON.stringify([{ title: 'New A', hook: 'a' }, { title: 'Kept', hook: 'dup' }, { title: 'New B', hook: 'b' }]);
    const agent = fakeAgent(() => okRun(reply));
    makeQueue(agent);
    const done = next('job.finished');
    await q.enqueueTopics(REL, { count: 3, source: 'real', exclude: [] });
    expect((await done).ok).toBe(true);
    const call = agent.calls[0];
    expect(call.prompt).toContain('Propose 2');
    expect(call.prompt).toContain('- Kept');
    expect(call.prompt).toContain('- Dropped');
    expect(call.opts.web).toBe(true);
    const f = await readFolder(tmp, REL);
    expect(f.topicRun.state).toBe('ready');
    expect(f.topicRun.titles.map((t: any) => t.title)).toEqual(['Kept', 'New A', 'New B']);
  });

  it('cancel', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const x = await addCard('x');
    const y = await addCard('y');
    await q.enqueueCard(REL, x.id);
    await q.enqueueCard(REL, y.id);
    await agent.called(1);
    await q.cancel();
    expect(await cardOf(x.id)).toMatchObject({ state: 'failed', failedStep: 'script', error: 'Cancelled' });
    expect((await agent.called(2)).prompt).toContain('T y');
  });

  it('a broken job does not stop the queue', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const x = await addCard('x');
    const y = await addCard('y');
    q.setPaused(true);
    await q.enqueueCard(REL, x.id);
    await q.enqueueCard(REL, y.id);
    await updateFolder(tmp, REL, (f: any) => { f.cards = f.cards.filter((c: any) => c.id !== x.id); });
    const done = next('job.finished');
    q.setPaused(false);
    expect((await done).ok).toBe(false);
    expect((await agent.called(1)).prompt).toContain('T y');
  });

  it('paused', async () => {
    const agent = fakeAgent();
    makeQueue(agent);
    const card = await addCard('p');
    q.setPaused(true);
    expect(await q.enqueueCard(REL, card.id)).toMatchObject({ kind: 'script', cardId: card.id, folderPath: REL, agent: 'codex', attempt: 1 });
    expect(await q.enqueueCard(REL, card.id)).toBeNull();
    await new Promise((r) => setImmediate(r));
    expect(agent.calls).toHaveLength(0);
    expect(q.snapshot()).toMatchObject({ running: null, paused: true });
    q.setPaused(false);
    await agent.called(1);
    expect(q.snapshot().running.cardId).toBe(card.id);
  });

  it('reorder and remove', async () => {
    makeQueue(fakeAgent());
    q.setPaused(true);
    const ids = [];
    for (const s of ['a', 'b', 'c']) ids.push((await q.enqueueCard(REL, (await addCard(s)).id)).id);
    q.reorder([ids[2], ids[0]]);
    expect(q.snapshot().queued.map((j: any) => j.id)).toEqual([ids[2], ids[0], ids[1]]);
    await q.remove(ids[0]);
    expect(q.snapshot().queued.map((j: any) => j.id)).toEqual([ids[2], ids[1]]);
  });

  it('removing a card job fails the card; removing a topics job just drops it', async () => {
    makeQueue(fakeAgent());
    q.setPaused(true);
    const card = await addCard('a');
    const job = await q.enqueueCard(REL, card.id);
    const changed = next('folder.changed');
    await q.remove(job.id);
    expect((await changed).path).toBe(REL);
    expect(await cardOf(card.id)).toMatchObject({ state: 'failed', failedStep: 'script', error: 'Removed from queue' });
    const topics = await q.enqueueTopics(REL, { count: 3, source: 'made_up' });
    await q.remove(topics.id);
    expect(q.snapshot().queued).toEqual([]);
    expect((await readFolder(tmp, REL)).topicRun).toBeNull();
  });

  it('a retried revision does not overwrite the pre-revision snapshot', async () => {
    const scene = path.join(tmp, 'src/videos/r');
    await fs.mkdir(scene, { recursive: true });
    await fs.writeFile(path.join(scene, 'story.ts'), 'original');
    // The agent half-edits the scene, then fails.
    const agent = fakeAgent(async () => {
      await fs.writeFile(path.join(scene, 'story.ts'), 'half-edited');
      return { ok: false, events: [{ type: 'done', ok: false, text: 'crashed' }], tail: '' };
    });
    makeQueue(agent, { ...fakeMedia(), snapshotScene });
    const card = await addCard('r', {
      state: 'scene',
      notes: [{ at: 'x', text: 'bigger hero', previewVersion: 1 }],
      files: { previews: ['out/r/preview-v1.mp4'], stills: [] },
    });
    for (let run = 1; run <= 2; run++) {
      const done = next('job.finished');
      await q.enqueueCard(REL, card.id);
      expect((await done).ok).toBe(false);
      await updateFolder(tmp, REL, (f: any) => { f.cards = f.cards.map((c: any) => (c.id === card.id ? retry(c) : c)); });
    }
    expect(agent.calls).toHaveLength(2);
    expect(await fs.readFile(path.join(tmp, 'out/r/versions/v2/scene/story.ts'), 'utf8')).toBe('original');
  });

  it('a crash outside a job step does not stop the queue', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const real = bus;
    let thrown = false;
    bus = { ...real, emit(type: string, p: any) { if (type === 'job.started' && !thrown) { thrown = true; throw new Error('boom'); } real.emit(type, p); } };
    const agent = fakeAgent();
    makeQueue(agent);
    bus = real;
    const x = await addCard('x');
    const y = await addCard('y');
    q.setPaused(true);
    await q.enqueueCard(REL, x.id);
    await q.enqueueCard(REL, y.id);
    const done = next('job.finished');
    q.setPaused(false);
    expect(await done).toMatchObject({ ok: false, error: 'boom' });
    expect((await agent.called(1)).prompt).toContain('T y');
    expect(q.snapshot().running.cardId).toBe(y.id);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('start skips a corrupt folder and still recovers the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fs.mkdir(path.join(tmp, 'shorts/horror/Bad'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'shorts/horror/Bad/toonforge.json'), '{ not json');
    makeQueue(fakeAgent());
    const card = await addCard('i', { state: 'sound' });
    await expect(q.start()).resolves.toBeUndefined();
    expect(await cardOf(card.id)).toMatchObject({ state: 'failed', error: 'Interrupted when ToonForge closed' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('shorts/horror/Bad'), expect.anything());
    warn.mockRestore();
  });
});
