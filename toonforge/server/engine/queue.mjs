import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileExists } from '../services/workspaceService.mjs';
import * as folders from './folders.mjs';
import * as realMedia from './media.mjs';
import { runAgent } from './runner.mjs';
import { AGENT_INFO, finalText } from './agents.mjs';
import { nextJob, completeJob, failJob, markInterrupted } from './cardMachine.mjs';
import { topicsPrompt, scriptPrompt, scenePrompt, soundPrompt, fixPrompt, revisePrompt, parseTopics } from './prompts.mjs';

/** @typedef {import('./cardMachine.mjs').JobKind} JobKind */
/** @typedef {import('./cardMachine.mjs').Card} Card */
/** @typedef {import('./agents.mjs').AgentId} AgentId */
/** @typedef {{ id: string, kind: JobKind, folderPath: string, cardId?: string, agent: AgentId, attempt: number, queuedAt: string, startedAt?: string, payload?: any }} Job */
/** @typedef {{ job: Job, signal: AbortSignal, log: object[], onEvent: (e: object) => void, media: { onLine: (l: string) => void, signal: AbortSignal } }} Ctx */
/** @typedef {{ files?: Record<string, any>, warnings?: string[], summary: string }} StepResult */

const FIX_ATTEMPTS = 2;
const clip = (s, n = 2000) => String(s ?? '').trim().slice(-n);
const lastLine = (s) => String(s ?? '').trim().split('\n').at(-1) ?? '';

/**
 * One global queue, one job at a time. Every dependency is injected so tests run without real CLIs.
 * @param {{ repoRoot: string, bus: { emit: (type: string, payload: object) => void }, store?: typeof folders,
 *   agents?: { runAgent: typeof runAgent }, media?: typeof realMedia, now?: () => Date }} deps
 */
export function createQueue({ repoRoot, bus, store = folders, agents = { runAgent }, media = realMedia, now = () => new Date() }) {
  /** @type {Job[]} */
  let queued = [];
  /** @type {Job|null} */
  let running = null;
  let paused = false;
  let looping = false;
  /** @type {AbortController|null} */
  let abort = null;
  /** @type {Promise<void>|null} */
  let current = null;

  const iso = () => now().toISOString();
  // Windows filenames cannot contain ':'.
  const stamp = () => iso().replace(/[:.]/g, '-');
  const snapshot = () => ({ running: running && { ...running }, queued: queued.map((j) => ({ ...j })), paused });
  const changed = () => bus.emit('queue.changed', { queue: snapshot() });

  async function saveFolder(folderPath, mutate) {
    const f = await store.updateFolder(repoRoot, folderPath, mutate);
    bus.emit('folder.changed', { path: folderPath });
    return f;
  }

  async function writeLog(rel, log) {
    const abs = path.join(repoRoot, rel);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, log.map((e) => JSON.stringify(e)).join('\n') + '\n');
    } catch { /* a lost log must not lose the card's result */ }
  }

  /** @param {Ctx} ctx @param {unknown} e */
  function errorText(ctx, e) {
    if (ctx.signal.aborted) return 'Cancelled';
    if (/** @type {any} */ (e)?.code === 'AGENT_MISSING') return `${AGENT_INFO[ctx.job.agent]?.label ?? ctx.job.agent} is not installed or not on PATH.`;
    return e instanceof Error ? e.message : String(e);
  }

  /** @param {Ctx} ctx @param {string} prompt @param {boolean} [web] */
  function callAgent(ctx, prompt, web) {
    if (ctx.signal.aborted) throw new Error('Cancelled');
    return agents.runAgent(ctx.job.agent, prompt, { cwd: repoRoot, web, signal: ctx.signal, onEvent: ctx.onEvent });
  }

  /**
   * Agent run, then engine check; a failed check goes back to the same agent up to FIX_ATTEMPTS times.
   * @param {Ctx} ctx @param {Card} card @param {string} prompt @param {() => Promise<{ ok: boolean, tail: string }>} check
   * @param {Record<string, any>} files @returns {Promise<StepResult>}
   */
  async function agentStep(ctx, card, prompt, check, files) {
    for (let attempt = 1; ; attempt++) {
      if (attempt > 1) {
        ctx.job.attempt = attempt;
        changed();
        ctx.onEvent({ type: 'log', text: `Engine check failed; fix attempt ${attempt - 1} of ${FIX_ATTEMPTS}` });
      }
      const r = await callAgent(ctx, prompt);
      if (!r.ok) throw new Error(clip(finalText(r.events) || r.tail) || 'Agent run failed');
      const c = await check();
      if (ctx.signal.aborted) throw new Error('Cancelled');
      if (c.ok) return { files, summary: finalText(r.events) };
      if (attempt > FIX_ATTEMPTS) throw new Error(clip(c.tail) || `${ctx.job.kind} check failed`);
      prompt = fixPrompt(card, ctx.job.kind, c.tail);
    }
  }

  /** @param {{ ok: boolean, tail: string, files?: object, warnings?: string[] }} r @param {Record<string, any>} [files] @returns {StepResult} */
  function mediaResult(r, files) {
    if (!r.ok) throw new Error(clip(r.tail) || 'Engine step failed');
    return { files: files ?? r.files, warnings: r.warnings, summary: lastLine(r.tail) || 'Done' };
  }

  const fileCheck = (rel) => async () =>
    ((await fileExists(path.join(repoRoot, rel))) ? { ok: true, tail: '' } : { ok: false, tail: `${rel} was not written.` });

  /** @type {Record<Exclude<JobKind, 'topics'>, (card: Card, folder: any, ctx: Ctx) => Promise<StepResult>>} */
  const EXECUTORS = {
    script(card, folder, ctx) {
      const rel = `${ctx.job.folderPath}/${card.slug}/SCRIPT.md`;
      return agentStep(ctx, card, scriptPrompt(card, folder), fileCheck(rel), { script: rel });
    },
    async scene(card, folder, ctx) {
      let prompt = scenePrompt(card);
      if (card.notes.length) {
        await media.snapshotScene(repoRoot, card.slug, card.files.previews.length + 1);
        prompt = revisePrompt(card, card.notes.at(-1).text, card.files.stills);
      }
      return agentStep(ctx, card, prompt, () => media.typecheck(repoRoot, ctx.media), { scene: `src/videos/${card.slug}` });
    },
    sound(card, folder, ctx) {
      const rel = `out/${card.slug}/mix.wav`;
      return agentStep(ctx, card, soundPrompt(card), fileCheck(rel), { mix: rel });
    },
    async words(card, folder, ctx) {
      const rel = `${ctx.job.folderPath}/${card.slug}/words.json`;
      return mediaResult(await media.makeWords(repoRoot, card.files.voice, rel, ctx.media), { words: rel });
    },
    async preview(card, folder, ctx) {
      return mediaResult(await media.renderPreview(repoRoot, card, card.files.previews.length + 1, ctx.media));
    },
    async render(card, folder, ctx) {
      return mediaResult(await media.renderFinal(repoRoot, card, ctx.media));
    },
  };

  /** @param {Ctx} ctx */
  async function runCardJob(ctx) {
    const { job } = ctx;
    const folder = await store.readFolder(repoRoot, job.folderPath);
    const card = folder.cards.find((c) => c.id === job.cardId);
    if (!card) throw new Error('Card not found');
    if (nextJob(card) !== job.kind) throw new Error(`Card is no longer waiting for ${job.kind}`);
    job.agent = folder.agent;
    changed();
    const logFile = `out/${card.slug}/logs/${job.kind}-${stamp()}.jsonl`;
    /** @type {StepResult|undefined} */
    let result;
    let error = null;
    try {
      result = await EXECUTORS[job.kind](card, folder, ctx);
    } catch (e) {
      error = errorText(ctx, e);
    }
    await writeLog(logFile, ctx.log);
    const entry = { at: iso(), step: job.kind, agent: job.agent, ok: !error, summary: clip(error ?? result?.summary, 500), logFile };
    await saveFolder(job.folderPath, (f) => {
      f.cards = f.cards.map((c) => {
        if (c.id !== job.cardId) return c;
        const next = error ? failJob(c, job.kind, error) : completeJob(c, job.kind, /** @type {StepResult} */ (result));
        return { ...next, history: [...(c.history ?? []), entry] };
      });
    });
    if (error) throw new Error(error);
  }

  /** @param {Ctx} ctx */
  async function runTopics(ctx) {
    const { job } = ctx;
    const { count, source, exclude = [] } = job.payload;
    const folder = await store.readFolder(repoRoot, job.folderPath);
    job.agent = folder.agent;
    changed();
    const prev = folder.topicRun?.titles ?? [];
    const kept = prev.filter((t) => t.starred);
    const ex = [...new Set([...exclude, ...prev.map((t) => t.title)])];
    const need = count - kept.length;
    const canSearchWeb = !!AGENT_INFO[job.agent]?.canSearchWeb;
    let topicRun;
    try {
      let titles = [];
      if (need > 0) {
        const prompt = topicsPrompt({ category: folder.category, count: need, source, exclude: ex, canSearchWeb });
        for (let i = 0; ; i++) {
          const r = await callAgent(ctx, prompt, source === 'real' && canSearchWeb);
          if (!r.ok) throw new Error(clip(finalText(r.events) || r.tail) || 'Agent run failed');
          try {
            titles = parseTopics(finalText(r.events), need, ex);
            break;
          } catch (e) {
            if (i > 0) throw e;
            ctx.onEvent({ type: 'log', text: 'Could not read a topic list from the reply; asking once more' });
          }
        }
      }
      topicRun = { count, source, state: 'ready', titles: [...kept, ...titles] };
    } catch (e) {
      topicRun = { ...folder.topicRun, count, source, state: 'error', error: errorText(ctx, e) };
    }
    await writeLog(`${job.folderPath}/logs/topics-${stamp()}.jsonl`, ctx.log);
    await saveFolder(job.folderPath, (f) => { f.topicRun = topicRun; });
    if (topicRun.state === 'error') throw new Error(topicRun.error);
  }

  /** @param {Job} job */
  async function runJob(job) {
    abort = new AbortController();
    /** @type {Ctx} */
    const ctx = {
      job,
      signal: abort.signal,
      log: [],
      onEvent: (event) => { ctx.log.push(event); bus.emit('job.event', { jobId: job.id, event }); },
      media: { signal: abort.signal, onLine: (text) => ctx.onEvent({ type: 'log', text }) },
    };
    try {
      await (job.kind === 'topics' ? runTopics(ctx) : runCardJob(ctx));
      return null;
    } catch (e) {
      return errorText(ctx, e);
    }
  }

  async function loop() {
    looping = true;
    try {
      while (!paused && queued.length) {
        const job = /** @type {Job} */ (queued.shift());
        let error = null;
        try {
          running = job;
          job.startedAt = iso();
          changed();
          bus.emit('job.started', { job: { ...job } });
          const work = runJob(job);
          current = work.then(() => {});
          error = await work;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          console.error('[queue] job crashed outside its step:', e);
        }
        running = null;
        abort = null;
        try {
          bus.emit('job.finished', { job: { ...job }, ok: !error, ...(error ? { error } : {}) });
          if (job.cardId) await enqueueCard(job.folderPath, job.cardId);
          changed();
        } catch (e) {
          console.error('[queue] after-job step failed:', e);
        }
      }
    } finally {
      looping = false;
    }
  }
  const kick = () => { if (!looping) loop().catch((e) => console.error('[queue] loop failed:', e)); };

  /** @param {Job} job */
  function insert(job) {
    const i = job.kind === 'render' ? queued.findIndex((j) => j.kind !== 'render') : -1;
    if (i === -1) queued.push(job); else queued.splice(i, 0, job);
    changed();
    kick();
    return job;
  }

  const newJob = (kind, folderPath, agent, extra) =>
    ({ id: `j_${randomBytes(4).toString('hex')}`, kind, folderPath, agent, attempt: 1, queuedAt: iso(), ...extra });

  /** @param {string} folderPath @param {string} cardId @returns {Promise<Job|null>} */
  async function enqueueCard(folderPath, cardId) {
    const folder = await store.readFolder(repoRoot, folderPath);
    const card = folder.cards.find((c) => c.id === cardId);
    const kind = card && nextJob(card);
    if (!kind) return null;
    if ([running, ...queued].some((j) => j?.cardId === cardId && j.folderPath === folderPath)) return null;
    return insert(newJob(kind, folderPath, folder.agent, { cardId }));
  }

  return {
    snapshot,
    enqueueCard,

    /** @param {string} folderPath @param {{ count: number, source: 'real'|'made_up', exclude?: string[] }} payload @returns {Promise<Job>} */
    async enqueueTopics(folderPath, { count, source, exclude = [] }) {
      const folder = await store.readFolder(repoRoot, folderPath);
      return insert(newJob('topics', folderPath, folder.agent, { payload: { count, source, exclude } }));
    },

    /** Fail cards left in running states by a previous session, then queue whatever is ready (e.g. word timings). */
    async start() {
      for (const { path: rel } of await store.listAllFolders(repoRoot)) {
        try {
          const folder = await store.readFolder(repoRoot, rel);
          if (folder.cards.some((c) => markInterrupted(c) !== c)) {
            await saveFolder(rel, (f) => { f.cards = f.cards.map(markInterrupted); });
          }
          for (const c of folder.cards) await enqueueCard(rel, c.id);
        } catch (e) {
          // One unreadable folder must not block recovery of the others.
          console.warn(`[queue] skipped unreadable folder ${rel}:`, e instanceof Error ? e.message : e);
        }
      }
      kick();
    },

    /** Abort the running job and wait until its card is persisted as failed. */
    async cancel() {
      if (!abort) return;
      abort.abort();
      await current;
    },

    /** @param {boolean} p */
    setPaused(p) {
      paused = !!p;
      changed();
      kick();
    },

    /** Queued jobs in the given order; ids not listed keep their relative order after them. @param {string[]} jobIds */
    reorder(jobIds) {
      const picked = [...new Set(jobIds)].map((id) => queued.find((j) => j.id === id)).filter((j) => !!j);
      queued = [...picked, ...queued.filter((j) => !picked.includes(j))];
      changed();
    },

    /** Drop a queued job; a card job's card becomes failed so the UI offers Retry. @param {string} jobId */
    async remove(jobId) {
      const job = queued.find((j) => j.id === jobId);
      if (!job) return;
      queued = queued.filter((j) => j !== job);
      changed();
      if (!job.cardId) return;
      await saveFolder(job.folderPath, (f) => {
        f.cards = f.cards.map((c) => (c.id === job.cardId ? failJob(c, job.kind, 'Removed from queue') : c));
      });
    },
  };
}
