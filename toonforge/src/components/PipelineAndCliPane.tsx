import { Clock, Terminal } from 'lucide-react';
import {
  AI_PROVIDER_GUIDES,
  computeCardCompletionPct,
  type CardItem,
  type CliEngine,
  type EnvProbe,
  type VideoStep,
} from '../lib/domain';

const CLI_ENGINES: { label: string; cmd: CliEngine }[] = [
  { label: 'Antigravity', cmd: 'agy' },
  { label: 'Claude', cmd: 'claude' },
  { label: 'Codex', cmd: 'codex' },
  { label: 'OpenCode', cmd: 'opencode' },
];

interface PipelineAndCliPaneProps {
  selectedCard?: CardItem;
  qaOverride: 'QA Next' | 'QA Pass' | null;
  pctOverride: number | null;
  activeCli: CliEngine;
  probes: EnvProbe[];
  cliInput: string;
  cliLogs: string[];
  onCliInputChange: (val: string) => void;
  onSelectCli: (cli: CliEngine) => void;
  onCopyOrPrepareCli: (cmdText: string, key: string) => void;
  onSubmitCli: (e: React.FormEvent) => void;
  onGuidedStep: (step: VideoStep) => void;
  onVerifyTypecheck: () => void;
}

export function PipelineAndCliPane({
  selectedCard,
  qaOverride,
  pctOverride,
  activeCli,
  probes,
  cliInput,
  cliLogs,
  onCliInputChange,
  onSelectCli,
  onCopyOrPrepareCli,
  onSubmitCli,
  onGuidedStep,
  onVerifyTypecheck,
}: PipelineAndCliPaneProps) {
  const realPct = pctOverride ?? computeCardCompletionPct(selectedCard);
  const qaLabel = qaOverride ?? (selectedCard?.qaReport ? 'QA Pass' : 'QA Next');
  const activeCliProbe = probes.find((p) => p.id === activeCli);
  const activeGuide = AI_PROVIDER_GUIDES[activeCli];

  return (
    <section className="tf-col-pipe tf-pane ql-surface ql-thick">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2
            className="font-display"
            style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Clock size={15} style={{ color: 'var(--g-prio)' }} />
            <span>Render Pipeline</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={onVerifyTypecheck} className="tf-btn tf-btn-mono ql-press" style={{ padding: '4px 10px' }}>
              TSC Check
            </button>
            <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--g-prio)' }}>
              {selectedCard?.loudness ? `${selectedCard.loudness} · ${realPct}%` : `${realPct}%`}
            </span>
          </div>
        </div>

        <div className="pipe-grid tabular">
          <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
            {selectedCard?.audioMode === 'no_vo' ? 'Visual Beat' : selectedCard?.voiceFile ? 'VO Found' : 'VO Wait'}
          </div>
          <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
            {selectedCard?.loudness || (selectedCard?.mixScript ? 'DSP Ready' : 'Mix Wait')}
          </div>
          <div className="pipe-step" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }}>
            {selectedCard?.videoFile ? '2K MP4' : `MP4 ${realPct}%`}
          </div>
          <div
            className="pipe-step"
            style={{
              background: qaLabel === 'QA Pass' ? 'var(--g-prio-bg)' : 'var(--g-sub)',
              color: qaLabel === 'QA Pass' ? 'var(--g-prio)' : 'var(--g-sec)',
            }}
          >
            {qaLabel}
          </div>
        </div>

        <div className="progress-track">
          <div style={{ height: '100%', width: `${realPct}%`, borderRadius: 9999, background: '#10b981', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div className="cli-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={14} />
          <div className="tf-tab-strip" style={{ flex: 1, borderBottom: 'none', paddingBottom: 0 }}>
            {CLI_ENGINES.map((engine) => (
              <button
                key={engine.cmd}
                type="button"
                onClick={() => onSelectCli(engine.cmd)}
                className={`tf-tab ql-press ${activeCli === engine.cmd ? 'is-active' : ''}`}
              >
                {engine.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-guide-bar">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{activeGuide.accountReq}</div>
            <div className="text-sec" style={{ fontSize: 12 }}>{activeGuide.summary}</div>
          </div>
          <button
            type="button"
            onClick={() =>
              onCopyOrPrepareCli(
                activeCliProbe?.installed ? activeGuide.loginCmd : activeGuide.installCmd,
                activeCliProbe?.installed ? 'cli-login' : 'cli-install',
              )
            }
            className="tf-badge ql-press shrink-0"
            style={{
              background: activeCliProbe?.installed ? 'var(--g-prio-bg)' : 'var(--g-sub)',
              color: activeCliProbe?.installed ? 'var(--g-prio)' : 'inherit',
              cursor: 'pointer',
            }}
          >
            <span>{activeCliProbe?.installed ? 'Ready on PATH' : 'Copy Install Cmd'}</span>
          </button>
        </div>

        <pre className="cli-log tabular">{cliLogs.join('\n')}</pre>

        <form onSubmit={onSubmitCli} className="cli-input-row">
          <input
            type="text"
            value={cliInput}
            onChange={(e) => onCliInputChange(e.target.value)}
            placeholder={`Type command or click a Video Step below (${activeCli})...`}
            className="cli-input"
          />
          <button type="submit" className="tf-btn tf-btn-mono ql-press">
            Run
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          <button type="button" onClick={() => onGuidedStep('script')} className="ql-press tf-btn tf-btn-mono">
            1. Script
          </button>
          <button type="button" onClick={() => onGuidedStep('audio')} className="ql-press tf-btn tf-btn-mono">
            2. Audio Mix
          </button>
          <button type="button" onClick={() => onGuidedStep('scene')} className="ql-press tf-btn tf-btn-mono">
            3. 3D Scene
          </button>
          <button type="button" onClick={() => onGuidedStep('render')} className="ql-press tf-btn tf-btn-prio">
            4. Render QA
          </button>
        </div>
      </div>
    </section>
  );
}
