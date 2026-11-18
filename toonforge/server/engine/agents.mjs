/**
 * @typedef {'claude'|'codex'|'opencode'|'agy'} AgentId
 * @typedef {{type:'message',text:string}
 *   | {type:'tool',name:string,target:string}
 *   | {type:'file',path:string,action:'read'|'write'}
 *   | {type:'error',text:string}
 *   | {type:'done',ok:boolean,text:string,costUsd?:number,durationMs?:number}} AgentEvent
 */

const CLAUDE_TOOLS = 'Read,Edit,Write,Glob,Grep,Bash(python:*),Bash(node:*),Bash(npx:*),Bash(ffmpeg:*),Bash(git:*)';

/** @type {Record<AgentId,{label:string,canSearchWeb:boolean,enforcement:string,structured:boolean}>} */
export const AGENT_INFO = {
  claude: {
    label: 'Claude Code',
    canSearchWeb: true,
    enforcement: "Limited to the skill's commands (python, node, npx, ffmpeg, git)",
    structured: true,
  },
  // `codex exec` has no --search flag (only top-level `codex` does), so no web.
  codex: {
    label: 'Codex',
    canSearchWeb: false,
    enforcement: 'Limited to this workspace folder; any command inside it',
    structured: true,
  },
  opencode: {
    label: 'OpenCode',
    canSearchWeb: false,
    enforcement: 'Uses your OpenCode permission settings',
    structured: false,
  },
  // agy can narrow commands only through allow/deny rules in the user's own settings.json
  // (or --settings), which ToonForge does not write; --mode accept-edits only auto-approves
  // file edits. So we cannot promise a command limit. agy print mode has no web-search flag.
  agy: {
    label: 'Antigravity',
    canSearchWeb: false,
    enforcement: 'Accept-edits mode; commands are not limited by ToonForge (your Antigravity permission rules apply)',
    structured: true,
  },
};

/**
 * @param {AgentId} agent
 * @param {string} prompt
 * @param {{web?:boolean}} opts
 * @returns {{bin:string,args:string[]}}
 */
export function agentInvocation(agent, prompt, opts = {}) {
  switch (agent) {
    case 'claude':
      // --allowedTools is variadic: as a separate token it swallows the trailing prompt, so use `=`.
      return {
        bin: 'claude',
        args: ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
          `--allowedTools=${CLAUDE_TOOLS}${opts.web ? ',WebSearch,WebFetch' : ''}`, prompt],
      };
    case 'codex':
      return { bin: 'codex', args: ['exec', '--json', '-s', 'workspace-write', prompt] };
    case 'agy':
      return { bin: 'agy', args: ['--mode', 'accept-edits', '--output-format', 'stream-json', '-p', prompt] };
    case 'opencode':
      return { bin: 'opencode', args: ['run', prompt] };
    default:
      throw new Error(`Unknown agent: ${agent}`);
  }
}

const msg = (text) => ({ type: 'message', text });
const firstString = (o, keys) => keys.map((k) => o?.[k]).find((v) => typeof v === 'string') ?? '';

function claudeEvents(o) {
  if (o.type === 'assistant') {
    return (o.message?.content ?? []).flatMap((b) => {
      if (b.type === 'text' && b.text?.trim()) return [msg(b.text)];
      if (b.type !== 'tool_use') return [];
      const input = b.input ?? {};
      if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(b.name) && input.file_path) {
        return [{ type: 'file', path: input.file_path, action: 'write' }];
      }
      if (b.name === 'Read' && input.file_path) return [{ type: 'file', path: input.file_path, action: 'read' }];
      return [{ type: 'tool', name: b.name, target: firstString(input, ['command', 'pattern', 'url', 'query', 'file_path']) }];
    });
  }
  if (o.type === 'result') {
    const ok = o.subtype === 'success' && !o.is_error;
    return [{ type: 'done', ok, text: String(o.result ?? ''), costUsd: o.total_cost_usd, durationMs: o.duration_ms }];
  }
  return [];
}

// Codex runs shell commands; spot the common PowerShell/shell ways of writing a file.
// shortcut: regex heuristic, misses exotic writes; upgrade by diffing the folder after the run.
const WRITE_CMD = /(?:Set-Content|Add-Content|Out-File)\s+(?:-(?:Literal)?Path\s+)?['"]?([^\s'"|]+)|>>?\s*['"]?([^\s'"|&]+)/i;

function codexEvents(o, state) {
  const item = o.item;
  if (o.type === 'item.completed' && item?.type === 'agent_message') {
    state.last = item.text;
    return [msg(item.text)];
  }
  if (item?.type === 'command_execution') {
    if (o.type === 'item.started') {
      const m = WRITE_CMD.exec(item.command ?? '');
      const evs = [{ type: 'tool', name: 'shell', target: item.command ?? '' }];
      if (m) evs.push({ type: 'file', path: m[1] ?? m[2], action: 'write' });
      return evs;
    }
    if (o.type === 'item.completed' && item.exit_code) return [{ type: 'error', text: `Command exited with ${item.exit_code}` }];
  }
  if (o.type === 'item.completed' && item?.type === 'file_change') {
    return (item.changes ?? []).map((c) => ({ type: 'file', path: c.path, action: 'write' }));
  }
  if (o.type === 'turn.completed') return [{ type: 'done', ok: true, text: state.last ?? '' }];
  if (o.type === 'turn.failed' || o.type === 'error') {
    const text = o.error?.message ?? o.message ?? 'Codex failed';
    return [{ type: 'error', text }, { type: 'done', ok: false, text }];
  }
  return [];
}

const AGY_WRITE = new Set(['write_file', 'replace_file_content', 'multi_replace_file_content', 'edit_file']);
const AGY_READ = new Set(['view_file', 'read_file']);

function agyEvents(o, state) {
  if (o.event === 'result') {
    const r = o.result ?? {};
    return [{ type: 'done', ok: r.status === 'SUCCESS', text: String(r.response ?? '').trim(),
      durationMs: r.duration_seconds != null ? Math.round(r.duration_seconds * 1000) : undefined }];
  }
  const s = o.step_update;
  if (o.event !== 'step_update' || !s) return [];
  if (s.step_type === 'agent_response') {
    state.text[s.step_index] = (state.text[s.step_index] ?? '') + (s.text_delta ?? '');
    const text = state.text[s.step_index].trim();
    return s.state === 'DONE' && text ? [msg(text)] : [];
  }
  if (s.step_type === 'tool' && s.state === 'ACTIVE') {
    const name = s.tool_name ?? s.tool_info?.name ?? 'tool';
    const params = s.tool_info?.parameters ?? {};
    const target = firstString(params, ['Path', 'path', 'AbsolutePath', 'TargetFile', 'CommandLine', 'command']);
    if (AGY_WRITE.has(name) && target) return [{ type: 'file', path: target, action: 'write' }];
    if (AGY_READ.has(name) && target) return [{ type: 'file', path: target, action: 'read' }];
    return [{ type: 'tool', name, target }];
  }
  return [];
}

/**
 * Stateful per run. OpenCode has no end marker, so the runner emits its `done` from the exit code.
 * @param {AgentId} agent
 * @returns {(line:string)=>AgentEvent[]}
 */
export function createParser(agent) {
  const state = { last: '', text: {} };
  return (line) => {
    if (!line.trim()) return [];
    if (agent === 'opencode') return [msg(line)];
    let o;
    try { o = JSON.parse(line); } catch { return [msg(line)]; }
    if (!o || typeof o !== 'object') return [msg(line)];
    if (agent === 'claude') return claudeEvents(o);
    if (agent === 'codex') return codexEvents(o, state);
    return agyEvents(o, state);
  };
}

/** @param {AgentEvent[]} events */
export function finalText(events) {
  const done = events.findLast((e) => e.type === 'done');
  if (done?.text) return done.text;
  return events.filter((e) => e.type === 'message').map((e) => e.text).join('\n');
}
