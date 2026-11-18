import { useState } from 'react';
import { ArrowRight, Check, CircleAlert, CircleCheck, Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { AI_PROVIDER_GUIDES, type CliEngine, type EnvProbe } from '../lib/domain';
import { PIPELINE, type PageId } from '../lib/pipeline';
import { CommandBlock, PageHeader } from './ui';

const SKILL_URL = 'https://github.com/mromidev/claude-animated-shorts';
const SKILL_INSTALL = `git clone ${SKILL_URL} ~/.claude/skills/cartoon-3d-short`;
export const AGENT_ORDER: CliEngine[] = ['claude', 'codex', 'opencode', 'agy'];

export function IntroPage({
  reqReady,
  reqTotal,
  onNavigate,
  onStart,
}: {
  reqReady: number;
  reqTotal: number;
  onNavigate: (page: PageId) => void;
  onStart: () => void;
}) {
  const missing = reqTotal - reqReady;
  return (
    <article className="page">
      <PageHeader
        title="Animated story shorts, made on your own PC"
        lead={
          <>
            ToonForge is a desktop app for the free{' '}
            <a href={SKILL_URL} target="_blank" rel="noreferrer">
              claude-animated-shorts
            </a>{' '}
            skill. The skill turns one true story into a 55 to 70 second vertical short: 2D characters in a colorful 3D
            world, rendered with three.js inside Remotion. No AI video generator is involved. ToonForge checks the software
            you need, keeps your shorts organized, and walks you through every step, handing the building work to your
            coding agent.
          </>
        }
      />

      <div className="callout">
        {missing > 0 ? (
          <>
            <CircleAlert size={18} className="warn" />
            <div className="grow">
              <strong>{missing} required {missing === 1 ? 'tool is' : 'tools are'} missing.</strong>{' '}
              <span className="muted">Install them before your first render.</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('requirements')}>
              <span>Check requirements</span>
              <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            {reqTotal > 0 ? <CircleCheck size={18} className="ok" /> : <LoaderCircle size={18} className="spin muted" />}
            <div className="grow">
              <strong>{reqTotal > 0 ? 'Everything needed to render is installed.' : 'Checking your software...'}</strong>
            </div>
            <button type="button" className="btn btn-primary" onClick={onStart}>
              <span>Start a short</span>
              <ArrowRight size={14} />
            </button>
          </>
        )}
      </div>

      <section className="section">
        <h2 className="section-title">What happens, step by step</h2>
        <ol className="flow">
          {PIPELINE.map((s, i) => (
            <li key={s.id} className="flow-row">
              <span className="flow-num tabular">{i + 1}</span>
              <div className="grow">
                <button type="button" className="link-btn flow-name" onClick={() => onNavigate(s.id)}>
                  {s.label}
                </button>
                <p className="muted">{s.summary}</p>
              </div>
              {s.output && <code className="flow-out">{s.output}</code>}
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <h2 className="section-title">Good to know</h2>
        <ul className="plain-list">
          <li>Everything renders locally. Nothing is uploaded, and there is no account to create for ToonForge itself.</li>
          <li>Your coding agent (Claude Code by default) does the writing and building. You need your own sign-in for it.</li>
          <li>Use your own story, characters and voice. The skill's reference frames are for matching the look only.</li>
        </ul>
        <button type="button" className="btn btn-quiet" onClick={() => onNavigate('howto')}>
          <span>Read how to use ToonForge</span>
          <ArrowRight size={14} />
        </button>
      </section>
    </article>
  );
}

export function HowToPage({ repoRoot, onNavigate }: { repoRoot?: string; onNavigate: (page: PageId) => void }) {
  return (
    <article className="page">
      <PageHeader title="How to use ToonForge" lead="First-time setup takes about fifteen minutes. After that, each short starts from the sidebar." />

      <ol className="howto">
        <li>
          <h2>Install the required software</h2>
          <p className="muted">
            Git, Node.js, Python with NumPy and Pillow, FFmpeg, Remotion's Chromium, a coding agent, and the skill itself. The
            Requirements page shows what is missing and installs each one for you with one click.
          </p>
          <button type="button" className="btn btn-quiet" onClick={() => onNavigate('requirements')}>
            <span>Open Requirements</span>
            <ArrowRight size={14} />
          </button>
        </li>
        <li>
          <h2>Install the skill</h2>
          <p className="muted">
            Press Install next to the skill on the Requirements page, or clone it yourself into your Claude skills folder so your
            agent can read SKILL.md and the templates.
          </p>
          <CommandBlock text={SKILL_INSTALL} />
        </li>
        <li>
          <h2>Open your Remotion project</h2>
          <p className="muted">
            ToonForge works inside the project folder it was started from. Scripts, voice files, mixes and renders are all read
            from and written to it. <strong>Sync</strong> at the bottom of the sidebar pulls the latest changes with git.
          </p>
          {repoRoot && (
            <p className="path">
              Current workspace: <code>{repoRoot}</code>
            </p>
          )}
        </li>
        <li>
          <h2>Sign in to your agent</h2>
          <p className="muted">Run your agent once in a terminal to sign in. Claude Code opens a browser window on its first run.</p>
          <CommandBlock text="claude" />
        </li>
        <li>
          <h2>Make a short</h2>
          <p className="muted">
            Press <strong>+</strong> next to the short picker, then work down the sidebar from Topic to Render & QA. A check mark
            appears once the workspace holds that step's file. On agent steps, <strong>Send to agent</strong> puts the exact
            prompt in the agent terminal for you to review and run.
          </p>
        </li>
      </ol>

      <section className="section">
        <h2 className="section-title">Tips from the skill</h2>
        <ul className="plain-list">
          <li>
            Point <code>REMOTION_TMP</code> at a folder on a big drive. Every Remotion bundle copies <code>public/</code>{' '}
            (about 1.3 GB) into the temp folder.
            <CommandBlock text="setx REMOTION_TMP D:\remotion-tmp" />
          </li>
          <li>Check stills before the final render. A 2K render takes minutes; a still takes seconds.</li>
          <li>Keep scripts between 55 and 70 seconds. The Script page estimates length as you type.</li>
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">Choosing an agent</h2>
        <dl className="agents">
          {AGENT_ORDER.map((id) => {
            const g = AI_PROVIDER_GUIDES[id];
            return (
              <div key={id} className="agent-row">
                <dt>{g.title}</dt>
                <dd>
                  <span>{g.accountReq}.</span> <span className="muted">{g.summary}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </article>
  );
}

export type InstallState = { state: 'busy' | 'done' | 'error'; text?: string };

const MONOGRAM: Record<string, string> = {
  git: 'Git',
  node: 'JS',
  python: 'Py',
  py_deps: 'Np',
  ffmpeg: 'FF',
  chromium: 'Cr',
  skill: 'Sk',
  claude: 'CC',
  codex: 'Cx',
  opencode: 'OC',
  agy: 'AG',
};

export function RequirementsPage({
  videoReqs,
  agentProbes,
  skillProbe,
  installs,
  aiSetupPrompt,
  manualCommands,
  checking,
  onRecheck,
  onInstall,
  onInstallAll,
  onSendToAgent,
  onVerify,
}: {
  videoReqs: EnvProbe[];
  agentProbes: EnvProbe[];
  skillProbe?: EnvProbe;
  installs: Record<string, InstallState>;
  aiSetupPrompt: string;
  manualCommands: string;
  checking: boolean;
  onRecheck: () => void;
  onInstall: (id: string) => void;
  onInstallAll: (ids: string[]) => void;
  onSendToAgent: (text: string) => void;
  onVerify: () => void;
}) {
  const [mode, setMode] = useState<'agent' | 'manual'>('agent');
  const required = skillProbe ? [...videoReqs, skillProbe] : videoReqs;
  const missing = required.filter((p) => !p.installed && installs[p.id]?.state !== 'busy').map((p) => p.id);
  const anyBusy = Object.values(installs).some((i) => i.state === 'busy');
  const anyAgent = agentProbes.some((p) => p.installed);
  // Installed agents first, then Claude Code (what the skill targets), then the rest.
  const agents = [...agentProbes].sort(
    (a, b) => Number(b.installed) - Number(a.installed) || Number(b.id === 'claude') - Number(a.id === 'claude'),
  );

  return (
    <article className="page">
      <PageHeader
        title="Requirements"
        lead="Everything the skill needs. Press Install and ToonForge runs the installer for you in the background, no terminal needed."
        actions={
          <>
            <button type="button" className="btn btn-quiet" onClick={onRecheck} disabled={checking}>
              <RefreshCw size={14} className={checking ? 'spin' : undefined} />
              <span>{checking ? 'Checking' : 'Check again'}</span>
            </button>
            {missing.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => onInstallAll(missing)} disabled={anyBusy}>
                <Download size={14} />
                <span>Install all missing ({missing.length})</span>
              </button>
            )}
          </>
        }
      />

      <section className="section">
        <div className="ext-head">
          <h2 className="section-title">Required</h2>
          <span className="muted small">
            {required.filter((p) => p.installed).length} of {required.length} installed
          </span>
        </div>
        <ExtList probes={required} installs={installs} onInstall={onInstall} />
      </section>

      <section className="section">
        <div className="ext-head">
          <h2 className="section-title">AI agents</h2>
          <span className="muted small">
            {anyAgent ? 'You have one. Add more only if you want another model.' : 'Install one. The skill was written for Claude Code.'}
          </span>
        </div>
        <ExtList probes={agents} installs={installs} onInstall={onInstall} recommended={anyAgent ? undefined : 'claude'} optional={anyAgent} />
      </section>

      <details className="disclosure">
        <summary>Prefer the terminal?</summary>
        <div className="section">
          <div className="seg self-start" role="tablist" aria-label="Install method">
            <button type="button" role="tab" aria-selected={mode === 'agent'} className={mode === 'agent' ? 'is-active' : ''} onClick={() => setMode('agent')}>
              Let your agent do it
            </button>
            <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'is-active' : ''} onClick={() => setMode('manual')}>
              Run commands yourself
            </button>
          </div>
          {mode === 'agent' ? (
            <CommandBlock text={aiSetupPrompt} onSend={onSendToAgent} />
          ) : (
            <>
              <CommandBlock text={manualCommands} />
              <button type="button" className="btn btn-quiet self-start" onClick={onVerify}>
                <span>Print installed versions</span>
              </button>
            </>
          )}
        </div>
      </details>
    </article>
  );
}

function ExtList({
  probes,
  installs,
  onInstall,
  recommended,
  optional,
}: {
  probes: EnvProbe[];
  installs: Record<string, InstallState>;
  onInstall: (id: string) => void;
  recommended?: string;
  optional?: boolean;
}) {
  if (probes.length === 0) return <p className="muted">Checking...</p>;
  return (
    <ul className="ext-list">
      {probes.map((p) => {
        const inst = installs[p.id];
        const busy = inst?.state === 'busy';
        return (
          <li key={p.id} className="ext" aria-busy={busy}>
            {busy && <span className="ext-progress" aria-hidden="true" />}
            <span className="ext-icon" aria-hidden="true">
              {MONOGRAM[p.id] ?? p.name.slice(0, 2)}
            </span>
            <div className="grow">
              <div className="ext-title">
                <span className="ext-name">{p.name}</span>
                {p.installed && p.version && <span className="req-ver tabular">{p.version}</span>}
                {p.id === recommended && <span className="tag tag-prio">Recommended</span>}
                {optional && !p.installed && <span className="tag">Optional</span>}
              </div>
              {p.role && <div className="ext-desc">{p.role}</div>}
              {inst?.text && <div className={`small ${inst.state === 'error' ? 'err' : inst.state === 'done' ? 'warn' : 'muted'}`}>{inst.text}</div>}
            </div>
            <div className="ext-action">
              {p.installed ? (
                <span className="ext-ok">
                  <Check size={14} /> Installed
                </span>
              ) : busy ? (
                <button type="button" className="btn btn-quiet btn-sm" disabled>
                  <LoaderCircle size={14} className="spin" />
                  <span>Installing</span>
                </button>
              ) : p.id === 'agy' ? (
                <span className="muted small">Comes with Antigravity</span>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onInstall(p.id)} aria-label={`Install ${p.name}`}>
                  {inst?.state === 'error' ? 'Retry' : 'Install'}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
