import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { agentInvocation, createParser, AGENT_INFO } from './agents.mjs';

/** @typedef {import('./agents.mjs').AgentId} AgentId */
/** @typedef {import('./agents.mjs').AgentEvent} AgentEvent */

const TAIL_MAX = 8000;
const IS_WIN = process.platform === 'win32';

/**
 * Pull the node script an npm `.cmd` shim runs: the last quoted token on the last line using `%*`,
 * with %VAR% expanded from the shim's own SET lines (first assignment wins).
 * shortcut: handles npm's/Node's standard shims only; ignores conditional overrides (e.g. npx's FOR /F
 * prefix lookup, which falls back to the default NPX_CLI_JS); upgrade if other shim generators appear.
 * @param {string} shimPath
 * @returns {string|null}
 */
export function shimTarget(shimPath) {
  const dir = path.dirname(shimPath);
  const lines = fs.readFileSync(shimPath, 'utf8').split(/\r?\n/);
  const vars = {};
  for (const l of lines) {
    const m = /^\s*SET\s+"?([A-Za-z_]\w*)=([^"]*)"?\s*$/i.exec(l);
    if (m && !(m[1].toUpperCase() in vars)) vars[m[1].toUpperCase()] = m[2];
  }
  const line = lines.findLast((l) => l.includes('%*'));
  const quoted = line?.match(/"[^"]*"/g);
  if (!quoted) return null;
  const expand = (t, depth = 0) => t.replace(/%(~dp0|[A-Za-z_]\w*)%?/g, (all, n) => {
    if (/^~?dp0$/i.test(n)) return dir + path.sep;
    const v = vars[n.toUpperCase()];
    return v === undefined || depth > 5 ? all : expand(v, depth + 1);
  });
  const target = expand(quoted.at(-1).slice(1, -1));
  if (target.includes('%') || !/\.[cm]?js$/i.test(target)) return null;
  return path.normalize(target);
}

/** First PATH hit for a bare name, honouring PATHEXT. */
function findOnPath(bin) {
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const p = path.join(dir, bin + ext.toLowerCase());
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Windows only: turn a bare name into something spawnable without a shell. */
function resolveBin(bin, args, label) {
  if (!IS_WIN || /[\/]/.test(bin)) return { bin, args };
  const found = findOnPath(bin);
  if (!found || /\.(exe|com)$/i.test(found)) return { bin: found ?? bin, args };
  const target = /\.cmd$/i.test(found) ? shimTarget(found) : null;
  if (!target) throw new Error(`${label} is installed as a script ToonForge cannot start safely: ${found}`);
  return { bin: process.execPath, args: [target, ...args] };
}

/** @param {number} pid */
export function killTree(pid) {
  if (IS_WIN) {
    return new Promise((resolve) => execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve()));
  }
  try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
  return Promise.resolve();
}

/**
 * @param {string} bin
 * @param {string[]} args
 * @param {{cwd:string,onLine:(line:string,stream:'stdout'|'stderr')=>void,signal?:AbortSignal,label?:string}} opts
 * @returns {Promise<{code:number|null,tail:string}>}
 */
export function spawnLines(bin, args, { cwd, onLine, signal, label = bin }) {
  return new Promise((resolve, reject) => {
    let cmd;
    try { cmd = resolveBin(bin, args, label); } catch (e) { reject(e); return; }
    const child = spawn(cmd.bin, cmd.args, { cwd, shell: false, windowsHide: true, detached: !IS_WIN });
    let tail = '';
    let aborted = false;
    const bufs = { stdout: '', stderr: '' };
    const feed = (stream, chunk) => {
      tail = (tail + chunk).slice(-TAIL_MAX);
      const parts = (bufs[stream] + chunk).split('\n');
      bufs[stream] = parts.pop();
      for (const l of parts) onLine(l.replace(/\r$/, ''), stream);
    };
    child.stdout.setEncoding('utf8').on('data', (c) => feed('stdout', c));
    child.stderr.setEncoding('utf8').on('data', (c) => feed('stderr', c));
    const abort = () => { aborted = true; if (child.pid) killTree(child.pid); };
    if (signal) {
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    }
    child.on('error', (e) => { signal?.removeEventListener('abort', abort); reject(e); });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abort);
      for (const s of ['stdout', 'stderr']) if (bufs[s]) onLine(bufs[s].replace(/\r$/, ''), s);
      resolve({ code: aborted ? null : code, tail });
    });
  });
}

/**
 * `opts.invocation` is a test seam that replaces agentInvocation().
 * @param {AgentId} agent
 * @param {string} prompt
 * @param {{cwd:string,web?:boolean,signal?:AbortSignal,onEvent:(e:AgentEvent)=>void,invocation?:{bin:string,args:string[]}}} opts
 * @returns {Promise<{ok:boolean,events:AgentEvent[],tail:string}>}
 */
export async function runAgent(agent, prompt, { cwd, web, signal, onEvent, invocation }) {
  const { bin, args } = invocation ?? agentInvocation(agent, prompt, { web });
  const parse = createParser(agent);
  const label = AGENT_INFO[agent].label;
  /** @type {AgentEvent[]} */
  const events = [];
  const emit = (e) => { events.push(e); onEvent?.(e); };
  let res;
  try {
    res = await spawnLines(bin, args, {
      cwd, signal, label,
      onLine: (line) => {
        let evs;
        try { evs = parse(line); } catch { evs = [{ type: 'message', text: line }]; }
        evs.forEach(emit);
      },
    });
  } catch (e) {
    if (e?.code === 'ENOENT') throw Object.assign(new Error(`${label} is not installed or not on PATH.`), { code: 'AGENT_MISSING' });
    throw e;
  }
  const done = events.findLast((e) => e.type === 'done');
  const ok = res.code === 0 && done?.ok !== false;
  if (!done) emit({ type: 'done', ok, text: res.tail.trim().split('\n').slice(-5).join('\n') });
  return { ok, events, tail: res.tail };
}
