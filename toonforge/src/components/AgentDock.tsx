import { useEffect, useRef } from 'react';
import { CircleAlert, CircleCheck, PanelRightClose, Terminal } from 'lucide-react';
import { AI_PROVIDER_GUIDES, type CliEngine, type EnvProbe } from '../lib/domain';
import { AGENT_ORDER } from './GuidePages';
import { CopyButton } from './ui';

const SHORT_NAME: Record<CliEngine, string> = { claude: 'Claude', codex: 'Codex', opencode: 'OpenCode', agy: 'Antigravity' };
// Mirrors AI_ENGINE_ARGS in server/services/jobRunner.mjs and agent_command in src-tauri/src/pty_host.rs.
const RUN_AS: Record<CliEngine, string> = { claude: 'claude -p', codex: 'codex exec', opencode: 'opencode run', agy: 'agy --mode accept-edits -p' };

export function AgentDock({
  activeCli,
  probes,
  input,
  logs,
  running,
  onSelectCli,
  onInputChange,
  onSubmit,
  onClose,
}: {
  activeCli: CliEngine;
  probes: EnvProbe[];
  input: string;
  logs: string[];
  running: boolean;
  onSelectCli: (cli: CliEngine) => void;
  onInputChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const guide = AI_PROVIDER_GUIDES[activeCli];
  const probe = probes.find((p) => p.id === activeCli);
  const logRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => {
    if (input) inputRef.current?.focus();
  }, [input]);

  return (
    <aside className="dock ql-surface ql-thick" aria-label="Agent terminal">
      <div className="dock-head">
        <Terminal size={16} />
        <span className="dock-title">Agent terminal</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close agent terminal">
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="seg seg-full" role="radiogroup" aria-label="Coding agent">
        {AGENT_ORDER.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={activeCli === id} className={activeCli === id ? 'is-active' : ''} onClick={() => onSelectCli(id)}>
            {SHORT_NAME[id]}
          </button>
        ))}
      </div>

      <div className="agent-guide">
        {probe?.installed ? <CircleCheck size={16} className="ok" /> : <CircleAlert size={16} className="warn" />}
        <div className="grow">
          <div className="small">{probe?.installed ? `${SHORT_NAME[activeCli]} is installed` : `${SHORT_NAME[activeCli]} is not on PATH`}</div>
          <div className="muted small">{guide.accountReq}</div>
        </div>
        {!probe?.installed && <CopyButton text={guide.installCmd} label="Install cmd" />}
      </div>

      <pre ref={logRef} className="log tabular" aria-live="polite">
        {logs.join('\n')}
      </pre>

      <form className="dock-input" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          rows={4}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(e);
          }}
          placeholder={`Prompt for ${SHORT_NAME[activeCli]}. Ctrl+Enter to run.`}
          aria-label="Agent prompt"
        />
        <div className="row between">
          <span className="muted small">
            Runs <code>{RUN_AS[activeCli]} "…"</code> in your workspace
          </span>
          <button type="submit" className="btn btn-primary" disabled={running || !input.trim()}>
            {running ? 'Running' : 'Run'}
          </button>
        </div>
      </form>
    </aside>
  );
}
