import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ValidationError, sanitizeSlug, compositionIdFromSlug } from '../services/workspaceService.mjs';
import * as folders from './folders.mjs';
import { AGENT_INFO } from './agents.mjs';
import { newCard, submitNotes, requestRender, retry, attachVoice } from './cardMachine.mjs';

export const DEFAULT_LIMITS = { voiceBytes: 200 * 1024 * 1024 };
const VOICE_MSG = 'Drop a .wav or .mp3 file up to 200 MB.';
const PING_MS = 15000;

/** @typedef {{ req: any, res: any, url: URL, repoRoot: string, queue: any, bus: any, limits: { voiceBytes: number }, readJsonBody: (req: any) => Promise<any>, sendJson: (res: any, status: number, body: any) => void }} Ctx */

const bad = (msg, status = 400) => new ValidationError(msg, status);

/** Folder `path` query values are `shorts/...` relative paths; anything else is a 400. @param {URL} url */
function folderPath(url) {
  const p = url.searchParams.get('path') ?? '';
  const parts = p.split('/');
  if (!p || p.includes('\\') || p.includes('\0') || path.isAbsolute(p) || /^[a-z]:/i.test(p) || parts[0] !== 'shorts' || parts.length < 3 || parts.some((s) => !s || s === '.' || s === '..')) {
    throw bad('Invalid folder path');
  }
  return p;
}

const withPath = (folder, p) => ({ ...folder, path: p });
const str = (v, what) => {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${what} is required`);
  return v;
};
const oneOf = (v, list, what) => {
  if (!list.includes(v)) throw bad(`${what} must be one of ${list.join(', ')}`);
  return v;
};

/** Apply a card change under the folder lock, announce it, then queue whatever the card now needs. */
async function changeCard(c, p, cardId, fn) {
  const folder = await folders.updateFolder(c.repoRoot, p, (f) => {
    const card = f.cards.find((x) => x.id === cardId);
    if (!card) throw bad('Card not found', 404);
    f.cards = f.cards.map((x) => (x === card ? fn(card, f) : x));
  });
  c.bus.emit('folder.changed', { path: p });
  await c.queue.enqueueCard(p, cardId);
  return folder;
}

const cardId = (url) => str(url.searchParams.get('card'), 'card');

/** Stream the request body into a temp file (never buffered), rename into place. Returns bytes written. */
async function streamToFile(req, dest, maxBytes) {
  const tmp = `${dest}.tmp-${randomBytes(4).toString('hex')}`;
  const fh = await fs.open(tmp, 'w');
  let total = 0;
  let over = false;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > maxBytes) over = true; // keep draining so the client gets the 413 instead of a reset
      if (!over) await fh.write(chunk);
    }
  } catch (e) {
    await fh.close();
    await fs.rm(tmp, { force: true });
    throw e;
  }
  await fh.close();
  if (over) {
    await fs.rm(tmp, { force: true });
    throw bad(VOICE_MSG, 413);
  }
  if (!total) {
    await fs.rm(tmp, { force: true });
    throw bad('The uploaded file is empty');
  }
  await fs.rename(tmp, dest);
}

/** @type {Record<string, (c: Ctx) => Promise<void> | void>} */
const ROUTES = {
  'GET /health': (c) => c.sendJson(c.res, 200, { ok: true }),

  'GET /tree': async (c) => c.sendJson(c.res, 200, await folders.listTree(c.repoRoot)),

  async 'POST /folders'(c) {
    const { category, name, agent } = await c.readJsonBody(c.req);
    str(category, 'category');
    oneOf(agent, Object.keys(AGENT_INFO), 'agent');
    const f = await folders.createFolder(c.repoRoot, { category, name, agent });
    c.bus.emit('tree.changed', {});
    c.sendJson(c.res, 200, withPath(f, `shorts/${f.category}/${f.name}`));
  },

  async 'GET /folder'(c) {
    const p = folderPath(c.url);
    c.sendJson(c.res, 200, withPath(await folders.readFolder(c.repoRoot, p), p));
  },

  async 'PATCH /folder'(c) {
    const p = folderPath(c.url);
    const { name, agent } = await c.readJsonBody(c.req);
    if (agent !== undefined) oneOf(agent, Object.keys(AGENT_INFO), 'agent');
    const renaming = typeof name === 'string' && name.trim();
    if (renaming) {
      const snap = c.queue.snapshot();
      if ([snap.running, ...snap.queued].some((j) => j?.folderPath === p)) {
        throw bad("Finish or cancel this folder's jobs before renaming", 409);
      }
    }
    let next = p;
    if (agent !== undefined) await folders.updateFolder(c.repoRoot, p, (f) => { f.agent = agent; });
    if (renaming) next = await folders.renameFolder(c.repoRoot, p, name);
    c.bus.emit('tree.changed', {});
    c.bus.emit('folder.changed', { path: next });
    c.sendJson(c.res, 200, withPath(await folders.readFolder(c.repoRoot, next), next));
  },

  async 'POST /topics'(c) {
    const p = folderPath(c.url);
    const { count, source } = await c.readJsonBody(c.req);
    if (!Number.isInteger(count) || count < 1 || count > 50) throw bad('count must be a whole number from 1 to 50');
    oneOf(source, ['real', 'made_up'], 'source');
    c.sendJson(c.res, 200, await c.queue.enqueueTopics(p, { count, source }));
  },

  async 'PATCH /topics'(c) {
    const p = folderPath(c.url);
    const { titles } = await c.readJsonBody(c.req);
    if (!Array.isArray(titles)) throw bad('titles must be a list');
    const f = await folders.updateFolder(c.repoRoot, p, (folder) => {
      if (!folder.topicRun) throw bad('This folder has no topic list yet', 409);
      const old = new Map(folder.topicRun.titles.map((t) => [t.title, t]));
      // Only titles that already exist survive; the client can star or drop them, not invent them.
      folder.topicRun.titles = titles
        .filter((t) => old.has(t?.title))
        .map((t) => ({ ...old.get(t.title), starred: !!t.starred }));
    });
    c.bus.emit('folder.changed', { path: p });
    c.sendJson(c.res, 200, withPath(f, p));
  },

  async 'POST /topics/reroll'(c) {
    const p = folderPath(c.url);
    const run = (await folders.readFolder(c.repoRoot, p)).topicRun;
    if (!run) throw bad('This folder has no topic list yet', 409);
    c.sendJson(c.res, 200, await c.queue.enqueueTopics(p, { count: run.count, source: run.source }));
  },

  async 'POST /topics/approve'(c) {
    const p = folderPath(c.url);
    const { items } = await c.readJsonBody(c.req);
    if (!Array.isArray(items) || !items.length) throw bad('Pick at least one topic');
    for (const it of items) {
      str(it?.title, 'title');
      oneOf(it.audio, ['vo', 'visual'], 'audio');
      oneOf(it.rig, ['chibi', 'stickman'], 'rig');
    }
    const created = [];
    const used = new Set();
    const f = await folders.updateFolder(c.repoRoot, p, async (folder) => {
      for (const it of items) {
        // uniqueSlug cannot see cards that are not saved yet, so also dodge this request's slugs.
        const base = sanitizeSlug(it.title) || 'short';
        let slug = await folders.uniqueSlug(c.repoRoot, it.title);
        for (let n = 2; used.has(slug) || (await folders.uniqueSlug(c.repoRoot, slug)) !== slug; n++) {
          slug = base.slice(0, 24 - String(n).length) + n;
        }
        used.add(slug);
        created.push(newCard({ title: it.title.trim(), hook: String(it.hook ?? ''), audio: it.audio, rig: it.rig, slug, compId: compositionIdFromSlug(slug) }));
      }
      folder.cards = [...folder.cards, ...created];
      folder.topicRun = null;
    });
    const lines = items.map((it) => `- ${it.title.trim()}: ${String(it.hook ?? '').trim()}\n`).join('');
    await fs.appendFile(path.join(c.repoRoot, p, 'topics.md'), lines);
    c.bus.emit('folder.changed', { path: p });
    for (const card of created) await c.queue.enqueueCard(p, card.id);
    c.sendJson(c.res, 200, withPath(f, p));
  },

  async 'POST /card/voice'(c) {
    const p = folderPath(c.url);
    const id = cardId(c.url);
    const ext = path.extname(String(c.req.headers['x-file-name'] ?? '')).toLowerCase();
    const len = Number(c.req.headers['content-length'] ?? 0);
    let rel;
    try {
      if (ext !== '.wav' && ext !== '.mp3') throw bad(VOICE_MSG, 415);
      if (len > c.limits.voiceBytes) throw bad(VOICE_MSG, 413);
      const card = (await folders.readFolder(c.repoRoot, p)).cards.find((x) => x.id === id);
      if (!card) throw bad('Card not found', 404);
      attachVoice(card, ''); // dry run: fail 409 before touching disk
      rel = `${p}/${card.slug}/voice${ext}`;
    } catch (e) {
      c.req.resume();
      throw e;
    }
    const dest = path.join(c.repoRoot, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await streamToFile(c.req, dest, c.limits.voiceBytes);
    const f = await changeCard(c, p, id, (card) => attachVoice(card, rel));
    c.sendJson(c.res, 200, withPath(f, p));
  },

  async 'POST /card/notes'(c) {
    const p = folderPath(c.url);
    const { text } = await c.readJsonBody(c.req);
    str(text, 'text');
    const f = await changeCard(c, p, cardId(c.url), (card) => submitNotes(card, text, new Date().toISOString()));
    c.sendJson(c.res, 200, withPath(f, p));
  },

  async 'POST /card/render'(c) {
    const p = folderPath(c.url);
    c.sendJson(c.res, 200, withPath(await changeCard(c, p, cardId(c.url), requestRender), p));
  },

  async 'POST /card/retry'(c) {
    const p = folderPath(c.url);
    c.sendJson(c.res, 200, withPath(await changeCard(c, p, cardId(c.url), retry), p));
  },

  async 'POST /card/resume'(c) {
    const p = folderPath(c.url);
    const f = await changeCard(c, p, cardId(c.url), (card) => {
      if (!card.imported) throw bad('Only an imported card needs resuming', 409);
      return { ...card, resumed: true };
    });
    c.sendJson(c.res, 200, withPath(f, p));
  },

  async 'PUT /card/script'(c) {
    const p = folderPath(c.url);
    const { content } = await c.readJsonBody(c.req);
    if (typeof content !== 'string') throw bad('content must be text');
    const card = (await folders.readFolder(c.repoRoot, p)).cards.find((x) => x.id === cardId(c.url));
    if (!card) throw bad('Card not found', 404);
    const dest = path.join(c.repoRoot, card.files.script ?? `${p}/${card.slug}/SCRIPT.md`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
    c.sendJson(c.res, 200, { ok: true });
  },

  'GET /queue': (c) => c.sendJson(c.res, 200, c.queue.snapshot()),

  async 'POST /queue/cancel'(c) {
    await c.queue.cancel();
    c.sendJson(c.res, 200, c.queue.snapshot());
  },

  async 'POST /queue/pause'(c) {
    const { paused } = await c.readJsonBody(c.req);
    if (typeof paused !== 'boolean') throw bad('paused must be true or false');
    c.queue.setPaused(paused);
    c.sendJson(c.res, 200, c.queue.snapshot());
  },

  async 'POST /queue/reorder'(c) {
    const { jobIds } = await c.readJsonBody(c.req);
    if (!Array.isArray(jobIds) || jobIds.some((x) => typeof x !== 'string')) throw bad('jobIds must be a list of ids');
    c.queue.reorder(jobIds);
    c.sendJson(c.res, 200, c.queue.snapshot());
  },

  async 'POST /queue/remove'(c) {
    const { jobId } = await c.readJsonBody(c.req);
    await c.queue.remove(str(jobId, 'jobId'));
    c.sendJson(c.res, 200, c.queue.snapshot());
  },

  'GET /events'(c) {
    const { req, res } = c;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const unsub = c.bus.subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
    const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
    req.on('close', () => { clearInterval(ping); unsub(); });
  },
};

/** @param {string} method @param {string} route @returns {((c: Ctx) => Promise<void> | void) | undefined} */
export const matchEngineRoute = (method, route) => ROUTES[`${method} ${route}`];
