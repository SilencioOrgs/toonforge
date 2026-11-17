import type { RefObject } from 'react';
import { ArrowRight, Check, Copy, Terminal } from 'lucide-react';
import type { CliEngine, EnvProbe } from '../lib/domain';

interface SetupWizardDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  videoReqs: EnvProbe[];
  setupTab: 'ai' | 'manual' | 'walk';
  activeCli: CliEngine;
  aiSetupPrompt: string;
  manualCommands: string;
  copiedKey: string | null;
  onChangeTab: (tab: 'ai' | 'manual' | 'walk') => void;
  onCopy: (key: string, text: string) => void;
  onLoadPromptInCli: () => void;
  onVerifyVideoStack: () => void;
}

export function SetupWizardDialog({
  dialogRef,
  videoReqs,
  setupTab,
  activeCli,
  aiSetupPrompt,
  manualCommands,
  copiedKey,
  onChangeTab,
  onCopy,
  onLoadPromptInCli,
  onVerifyVideoStack,
}: SetupWizardDialogProps) {
  return (
    <dialog ref={dialogRef} className="tf-dialog">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Video Creation Stack — Needed to Create Videos
        </h3>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ql-press tf-btn"
          style={{ background: 'rgba(255,255,255,0.14)', color: '#fafafa' }}
        >
          Close
        </button>
      </div>

      <div className="req-list">
        {videoReqs.map((p) => (
          <div key={p.id} className="req-row">
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>{p.role}</div>
            </div>
            <button
              type="button"
              onClick={() => p.installCmd && onCopy(`req-${p.id}`, p.installCmd)}
              className="tf-badge tabular ql-press shrink-0"
              style={{
                background: p.installed ? 'rgba(16,185,129,0.20)' : 'rgba(255,255,255,0.10)',
                color: p.installed ? '#34d399' : '#fafafa',
                cursor: 'pointer',
              }}
            >
              <span>{p.installed ? 'OK' : copiedKey === `req-${p.id}` ? 'Copied' : 'Copy Install'}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="tf-tab-strip" style={{ marginBottom: 12, borderBottomColor: 'rgba(255,255,255,0.16)' }}>
        <button type="button" onClick={() => onChangeTab('ai')} className={`tf-tab ql-press ${setupTab === 'ai' ? 'is-active' : ''}`}>
          AI Auto-Setup Prompt
        </button>
        <button type="button" onClick={() => onChangeTab('manual')} className={`tf-tab ql-press ${setupTab === 'manual' ? 'is-active' : ''}`}>
          Manual Terminal
        </button>
        <button type="button" onClick={() => onChangeTab('walk')} className={`tf-tab ql-press ${setupTab === 'walk' ? 'is-active' : ''}`}>
          How Videos Are Made
        </button>
      </div>

      {setupTab === 'ai' && (
        <div>
          <pre className="cli-log" style={{ height: 108, marginBottom: 12, border: '1px solid rgba(255,255,255,0.16)' }}>
            {aiSetupPrompt}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => onCopy('ai', aiSetupPrompt)}
              className="ql-press tf-btn"
              style={{ background: '#27272a', color: '#fafafa' }}
            >
              {copiedKey === 'ai' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey === 'ai' ? 'Copied' : 'Copy Prompt'}</span>
            </button>
            <button type="button" onClick={onLoadPromptInCli} className="ql-press tf-btn tf-btn-prio">
              <ArrowRight size={14} />
              <span>Load into {activeCli}</span>
            </button>
          </div>
        </div>
      )}

      {setupTab === 'manual' && (
        <div>
          <pre className="cli-log tabular" style={{ height: 108, marginBottom: 12, border: '1px solid rgba(255,255,255,0.16)' }}>
            {manualCommands}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => onCopy('manual', manualCommands)}
              className="ql-press tf-btn"
              style={{ background: '#27272a', color: '#fafafa' }}
            >
              {copiedKey === 'manual' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey === 'manual' ? 'Copied' : 'Copy Commands'}</span>
            </button>
            <button type="button" onClick={onVerifyVideoStack} className="ql-press tf-btn tf-btn-prio">
              <Terminal size={14} />
              <span>Verify Video Stack Now</span>
            </button>
          </div>
        </div>
      )}

      {setupTab === 'walk' && (
        <div>
          <div className="walk-row">
            <span className="tf-badge tabular" style={{ background: '#047857', color: '#ffffff' }}>1</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Write Script (`SCRIPT_*.md`) + Optional Voiceover (`voice/*.wav`)</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>Drop VO to auto-queue, or toggle badge to No-VO Mode for visual-only beats.</div>
            </div>
          </div>
          <div className="walk-row">
            <span className="tf-badge tabular" style={{ background: '#27272a', color: '#fafafa' }}>2</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Audio DSP (`python audio/mix_&lt;slug&gt;.py`) + Scene (`src/videos/&lt;slug&gt;/`)</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>Use AI CLI Steps 2–3 with Stickman or Chibi sprites to sync shots and -15 LUFS mix.</div>
            </div>
          </div>
          <div className="walk-row">
            <span className="tf-badge tabular" style={{ background: '#27272a', color: '#fafafa' }}>3</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Render 2K MP4 (`remotion render`) + Frame QA (`scripts/short_qa.py`)</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>Preview the finished MP4 and QA contact sheets right inside Stage Preview.</div>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
