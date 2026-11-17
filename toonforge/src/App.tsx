import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Clock,
  Copy,
  GitBranch,
  ImagePlus,
  Layers,
  Mic,
  Moon,
  Play,
  Plus,
  Sparkles,
  Sun,
  Terminal,
  User,
  VolumeX,
} from 'lucide-react';
import { MATERIAL_PRESETS } from 'quick-liquid';
import { LogoSvg } from './components/LogoSvg';
import { StageSvg } from './components/StageSvg';
import * as backend from './lib/backend';
import {
  addCardToBoard,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  setCardRig,
  toggleCardAudioMode,
  type BoardState,
  type CliEngine,
  type EnvStatus,
  type LaneId,
  type LogoConcept,
  type RigMode,
  type RigSummary,
} from './lib/domain';

const FALLBACK_BOARD: BoardState = {
  version: 1,
  autoQueue: true,
  activeLane: 'queued',
  selectedCardId: 'dbindex',
  cards: [
    {
      id: 'async',
      slug: 'async',
      title: 'Async Job Queues',
      lane: 'backlog',
      audioMode: 'needs_vo',
      rigMode: 'chibi',
      durationLabel: 'Script Ready',
      compositionId: 'AsyncShort',
    },
    {
      id: 'dbindex',
      slug: 'dbindex',
      title: 'DbIndex (B-Tree)',
      lane: 'queued',
      audioMode: 'vo_ready',
      rigMode: 'chibi',
      durationLabel: '93.7s VO',
      compositionId: 'DbIndexShort',
    },
  ],
};

const CLI_ENGINES: { label: string; cmd: CliEngine }[] = [
  { label: 'Antigravity', cmd: 'agy' },
  { label: 'Claude', cmd: 'claude' },
  { label: 'Codex', cmd: 'codex' },
  { label: 'OpenCode', cmd: 'opencode' },
];

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeLogo, setActiveLogo] = useState<LogoConcept>('cube');
  const [board, setBoard] = useState<BoardState>(FALLBACK_BOARD);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [rigs, setRigs] = useState<RigSummary | null>(null);
  const [syncLabel, setSyncLabel] = useState('Sync Repo');
  const [activeCli, setActiveCli] = useState<CliEngine>('agy');
  const [cliInput, setCliInput] = useState('');
  const [cliLogs, setCliLogs] = useState<string[]>([
    'portable-pty ready · watching Content Bank & character rig',
    'agy > workspace bridge online',
  ]);
  const [renderPct, setRenderPct] = useState(68);
  const [qaStatus, setQaStatus] = useState<'QA Next' | 'QA Pass'>('QA Next');
  const [setupTab, setSetupTab] = useState<'ai' | 'manual' | 'walk'>('ai');
  const [copiedKey, setCopiedKey] = useState<'ai' | 'manual' | null>(null);

  const logoDialogRef = useRef<HTMLDialogElement>(null);
  const setupDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([backend.getEnvStatus(), backend.getRigs(), backend.loadBoard()])
      .then(([envRes, rigRes, boardRes]) => {
        if (!active) return;
        setEnv(envRes);
        setRigs(rigRes);
        setBoard(boardRes);
      })
      .catch(() => {
        // Keep responsive fallback state when bridge is temporarily unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const persistBoard = (next: BoardState) => {
    setBoard(next);
    backend.saveBoard(next).catch(() => {});
  };

  const selectedCard = useMemo(
    () => board.cards.find((c) => c.id === board.selectedCardId) ?? board.cards[0],
    [board],
  );

  const counts = useMemo(
    () => ({
      backlog: board.cards.filter((c) => c.lane === 'backlog').length,
      queued: board.cards.filter((c) => c.lane === 'queued').length,
      done: board.cards.filter((c) => c.lane === 'done').length,
    }),
    [board.cards],
  );

  const visibleCards = useMemo(
    () => board.cards.filter((c) => c.lane === board.activeLane),
    [board.cards, board.activeLane],
  );

  const probes = env?.probes ?? [];
  const aiSetupPrompt = useMemo(() => buildAiSetupPrompt(activeCli, probes), [activeCli, probes]);
  const manualCommands = useMemo(() => buildManualSetupCommands(probes), [probes]);

  const appendLog = (line: string) => {
    setCliLogs((prev) => [...prev.slice(-18), line]);
  };

  const handleSync = async () => {
    setSyncLabel('Syncing...');
    const res = await backend.syncRepo();
    setSyncLabel(res.ok ? 'Repo Ready' : 'Sync Err');
    res.lines.forEach((l) => appendLog(`git > ${l}`));
  };

  const handleRigChange = (rig: RigMode) => {
    if (!selectedCard) return;
    persistBoard(setCardRig(board, selectedCard.id, rig));
    appendLog(`${activeCli} > switched to ${rig === 'stickman' ? 'Built-in Stickman rig' : 'Custom Chibi sprite sheet'}`);
  };

  const handleStills = async () => {
    if (!selectedCard) return;
    const res = await backend.runPipeline(selectedCard.slug, 'stills');
    res.lines.forEach((l) => appendLog(`stills > ${l}`));
  };

  const handleRender = async () => {
    if (!selectedCard) return;
    setRenderPct(45);
    setQaStatus('QA Next');
    const res = await backend.runPipeline(selectedCard.slug, 'render');
    setRenderPct(100);
    setQaStatus(res.ok ? 'QA Pass' : 'QA Next');
    res.lines.forEach((l) => appendLog(`render > ${l}`));
  };

  const handleMacro = (macro: string) => {
    const context = selectedCard ? ` [${selectedCard.slug} · ${selectedCard.rigMode}]` : '';
    appendLog(`${activeCli} > "${macro}${context}"`);
  };

  const handleCliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;
    setCliInput('');
    appendLog(`${activeCli} $ ${cmd}`);
    const res = await backend.execCliCommand(activeCli, cmd);
    if (res.stdout.trim()) appendLog(res.stdout.trim());
    if (res.stderr.trim()) appendLog(`stderr: ${res.stderr.trim()}`);
  };

  const handleCopy = (kind: 'ai' | 'manual', text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(kind);
  };

  return (
    <div id="studio-frame" data-mode={theme}>
      {/* Top QuickLiquid Monochrome Bar */}
      <header
        data-ql-material="thin"
        data-ql-blur={MATERIAL_PRESETS.thin?.blur ?? 14}
        className="tf-topbar ql-surface ql-thin"
      >
        <div className="tf-brand">
          <div className="tf-logo-box">
            <LogoSvg concept={activeLogo} />
          </div>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
            ToonForge
          </span>
          <span className="tf-badge tabular" style={{ background: 'var(--g-sub)', color: 'var(--g-sec)' }}>
            Tauri + Rust
          </span>
        </div>

        <div className="tf-logo-strip">
          {(['cube', 'clapper', 'portal'] as LogoConcept[]).map((logo) => (
            <button
              key={logo}
              type="button"
              onClick={() => setActiveLogo(logo)}
              className={`tf-tab ql-press ${activeLogo === logo ? 'is-active' : ''}`}
            >
              {logo.charAt(0).toUpperCase() + logo.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => logoDialogRef.current?.showModal()}
            className="tf-btn ql-press"
            style={{ color: 'var(--g-sec)', fontWeight: 600 }}
          >
            Compare
          </button>
        </div>

        <div className="tf-top-actions">
          <button
            type="button"
            onClick={() => setupDialogRef.current?.showModal()}
            className="ql-surface ql-clear ql-press tf-btn"
          >
            <BookOpen size={14} style={{ color: 'var(--g-prio)' }} />
            <span>Setup Guide</span>
          </button>
          <button
            type="button"
            onClick={handleSync}
            className="ql-surface ql-clear ql-press tf-btn"
          >
            <GitBranch size={14} />
            <span>{syncLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="ql-surface ql-clear ql-press tf-btn"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Main 3-Pane Studio Workbench */}
      <div className="tf-grid">
        {/* LEFT PANE: Trello Content Bank + Auto-Queue */}
        <section
          data-ql-material="regular"
          data-ql-blur={MATERIAL_PRESETS.regular?.blur ?? 20}
          className="tf-col-bank tf-pane ql-surface ql-regular"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 className="font-display" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={15} />
                <span>Content Bank</span>
              </h2>
              <button
                type="button"
                onClick={() => persistBoard({ ...board, autoQueue: !board.autoQueue })}
                className="ql-press tf-btn"
                style={{
                  borderRadius: 9999,
                  fontWeight: 600,
                  background: board.autoQueue ? 'var(--g-prio-bg)' : 'var(--g-sub)',
                  color: board.autoQueue ? 'var(--g-prio)' : 'var(--g-sec)',
                }}
              >
                <Sparkles size={13} />
                <span>{board.autoQueue ? 'Auto-Q: ON' : 'Auto-Q: OFF'}</span>
              </button>
            </div>

            <div className="tf-tab-strip" style={{ marginBottom: 8 }}>
              {(['backlog', 'queued', 'done'] as LaneId[]).map((lane) => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => persistBoard({ ...board, activeLane: lane })}
                  className={`tf-tab ql-press tabular ${board.activeLane === lane ? 'is-active' : ''}`}
                >
                  <span>{lane.charAt(0).toUpperCase() + lane.slice(1)}</span>
                  <span>{counts[lane]}</span>
                </button>
              ))}
            </div>

            <div className="kanban-list">
              {visibleCards.map((card) => {
                const isSelected = card.id === selectedCard?.id;
                const badgeStyle =
                  card.audioMode === 'vo_ready'
                    ? { background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }
                    : { background: 'var(--g-sub)', color: card.audioMode === 'needs_vo' ? 'var(--g-sec)' : 'inherit' };
                const badgeText =
                  card.audioMode === 'vo_ready' ? 'VO Ready' : card.audioMode === 'no_vo' ? 'No-VO Mode' : 'Needs VO';

                return (
                  <div
                    key={card.id}
                    onClick={() => persistBoard({ ...board, selectedCardId: card.id })}
                    className={`kanban-row ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{card.title}</span>
                      <span className="text-sec" style={{ fontSize: 12, fontWeight: 500 }}>
                        {card.rigMode === 'stickman' ? 'Stickman' : 'Chibi'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = toggleCardAudioMode(board, card.id);
                          persistBoard(next);
                        }}
                        className="tf-badge ql-press"
                        style={{ ...badgeStyle, cursor: 'pointer' }}
                      >
                        {card.audioMode === 'no_vo' ? <VolumeX size={12} /> : <Mic size={12} />}
                        <span>{badgeText}</span>
                      </button>
                      <span className="text-sec tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {card.durationLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--g-divider)', fontSize: 12 }}>
            <span className="text-sec" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowRight size={13} />
              <span>Tap badge: VO / No-VO</span>
            </span>
            <button
              type="button"
              onClick={() => persistBoard(addCardToBoard(board, `New Short #${board.cards.length + 1}`, selectedCard?.rigMode ?? 'chibi'))}
              className="ql-surface ql-thin ql-press tf-btn"
            >
              <Plus size={13} />
              <span>Add Card</span>
            </button>
          </div>
        </section>

        {/* CENTER PANE: Character Rig Switcher + 9:16 Stage Preview */}
        <section
          data-ql-material="regular"
          data-ql-blur={MATERIAL_PRESETS.regular?.blur ?? 20}
          className="tf-col-stage tf-pane ql-surface ql-regular"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="font-display" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Stage Preview
            </h2>
            <span className="text-sec tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              1440×2560
            </span>
          </div>

          <div className="tf-tab-strip">
            <button
              type="button"
              onClick={() => handleRigChange('stickman')}
              className={`tf-tab ql-press ${selectedCard?.rigMode === 'stickman' ? 'is-active' : ''}`}
            >
              <User size={13} />
              <span>Stickman</span>
            </button>
            <button
              type="button"
              onClick={() => handleRigChange('chibi')}
              className={`tf-tab ql-press ${selectedCard?.rigMode !== 'stickman' ? 'is-active' : ''}`}
            >
              <ImagePlus size={13} />
              <span>Chibi Sheet</span>
            </button>
          </div>

          <div className="stage-canvas">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span className="tf-badge" style={{ background: '#ffffff', color: '#09090b', border: '2px solid #09090b' }}>
                {selectedCard?.compositionId ?? 'Stage'}
              </span>
              <span
                className="tf-badge"
                style={{
                  background: selectedCard?.audioMode === 'no_vo' ? '#18181b' : '#047857',
                  color: '#ffffff',
                }}
              >
                {selectedCard?.audioMode === 'no_vo' ? 'No-VO' : 'VO'}
              </span>
            </div>

            <StageSvg rigMode={selectedCard?.rigMode ?? 'chibi'} />

            <div className="stage-actions">
              <button type="button" onClick={handleStills} className="pill-light ql-press">
                <Camera size={13} />
                <span>Stills</span>
              </button>
              <button type="button" onClick={handleRender} className="pill-prio ql-press">
                <Play size={13} />
                <span>Render</span>
              </button>
            </div>
          </div>

          <div className="text-sec tabular" style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>{rigs ? `Chibi assets: ${rigs.chibi.sprites} sprites · ${rigs.chibi.faces} faces` : 'Loading workspace rigs...'}</span>
            <span>{env?.branch ? `git:${env.branch}` : 'git:main'}</span>
          </div>
        </section>

        {/* RIGHT PANE: Render Pipeline + Built-In Multi-AI CLI */}
        <section
          data-ql-material="thick"
          data-ql-blur={MATERIAL_PRESETS.thick?.blur ?? 28}
          className="tf-col-pipe tf-pane ql-surface ql-thick"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 className="font-display" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} style={{ color: 'var(--g-prio)' }} />
                <span>Render Pipeline</span>
              </h2>
              <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--g-prio)' }}>
                {selectedCard?.title.split(' ')[0]} · {renderPct}%
              </span>
            </div>

            <div className="pipe-grid tabular">
              <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
                {selectedCard?.audioMode === 'no_vo' ? 'Visual Beat' : 'VO Sync'}
              </div>
              <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
                {selectedCard?.audioMode === 'no_vo' ? 'Suno BGM' : '-15 LUFS'}
              </div>
              <div className="pipe-step" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }}>
                {renderPct < 100 ? `2K ${renderPct}%` : '2K Done'}
              </div>
              <div
                className="pipe-step"
                style={{
                  background: qaStatus === 'QA Pass' ? 'var(--g-prio-bg)' : 'var(--g-sub)',
                  color: qaStatus === 'QA Pass' ? 'var(--g-prio)' : 'var(--g-sec)',
                }}
              >
                {qaStatus}
              </div>
            </div>

            <div className="progress-track">
              <div style={{ height: '100%', width: `${renderPct}%`, borderRadius: 9999, background: '#10b981', transition: 'width 0.3s ease' }} />
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
                    onClick={() => {
                      setActiveCli(engine.cmd);
                      appendLog(`${engine.cmd} > attached · workspace ready`);
                    }}
                    className={`tf-tab ql-press ${activeCli === engine.cmd ? 'is-active' : ''}`}
                  >
                    {engine.label}
                  </button>
                ))}
              </div>
            </div>

            <pre className="cli-log tabular">{cliLogs.join('\n')}</pre>

            <form onSubmit={handleCliSubmit} className="cli-input-row">
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder={`Run shell / ${activeCli} command in repo...`}
                className="cli-input"
              />
              <button type="submit" className="tf-btn tf-btn-mono ql-press">
                Run
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => handleMacro('Build from active Trello card')} className="ql-press tf-btn tf-btn-mono">
                + Build Card
              </button>
              <button type="button" onClick={() => handleMacro('Switch character rig & align FX')} className="ql-press tf-btn tf-btn-mono">
                Align Rig
              </button>
              <button type="button" onClick={() => handleMacro('Generate FB captions')} className="ql-press tf-btn tf-btn-mono">
                FB Caption
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Logo Comparison Dialog */}
      <dialog ref={logoDialogRef} className="tf-dialog">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Choose ToonForge App Icon
          </h3>
          <button
            type="button"
            onClick={() => logoDialogRef.current?.close()}
            className="ql-press tf-btn"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fafafa' }}
          >
            Apply Icon
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {(
            [
              { id: 'cube', name: 'Iso Cube + Chibi', desc: 'B&W rig + prio emerald core' },
              { id: 'clapper', name: 'Toon Clapper', desc: 'Monochrome slate + CLI' },
              { id: 'portal', name: '9:16 Arcade Portal', desc: 'Vertical stage + prio beam' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveLogo(item.id);
                logoDialogRef.current?.close();
              }}
              className="pick-logo ql-press"
            >
              <div style={{ width: 56, height: 56, margin: '0 auto 8px auto' }}>
                <LogoSvg concept={item.id} />
              </div>
              <div className="font-display" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </dialog>

      {/* First-Run Setup Wizard & 3-Step Walkthrough Dialog */}
      <dialog ref={setupDialogRef} className="tf-dialog">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            First-Run Setup &amp; Walkthrough
          </h3>
          <button
            type="button"
            onClick={() => setupDialogRef.current?.close()}
            className="ql-press tf-btn"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fafafa' }}
          >
            Close
          </button>
        </div>

        <div className="probe-strip">
          {probes.map((p) => (
            <span
              key={p.id}
              className="tf-badge tabular"
              style={{
                background: p.installed ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)',
                color: p.installed ? '#34d399' : '#d4d4d8',
              }}
            >
              {p.name}: {p.installed ? 'OK' : 'Missing'}
            </span>
          ))}
        </div>

        <div className="tf-tab-strip" style={{ marginBottom: 12, borderBottomColor: 'rgba(255,255,255,0.16)' }}>
          <button
            type="button"
            onClick={() => setSetupTab('ai')}
            className={`tf-tab ql-press ${setupTab === 'ai' ? 'is-active' : ''}`}
          >
            AI Auto-Setup Prompt
          </button>
          <button
            type="button"
            onClick={() => setSetupTab('manual')}
            className={`tf-tab ql-press ${setupTab === 'manual' ? 'is-active' : ''}`}
          >
            Manual Terminal
          </button>
          <button
            type="button"
            onClick={() => setSetupTab('walk')}
            className={`tf-tab ql-press ${setupTab === 'walk' ? 'is-active' : ''}`}
          >
            Quick Walkthrough
          </button>
        </div>

        {setupTab === 'ai' && (
          <div>
            <pre className="cli-log" style={{ height: 112, marginBottom: 12, border: '1px solid rgba(255,255,255,0.16)' }}>
              {aiSetupPrompt}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleCopy('ai', aiSetupPrompt)}
                className="ql-press tf-btn"
                style={{ background: '#27272a', color: '#fafafa' }}
              >
                {copiedKey === 'ai' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey === 'ai' ? 'Copied' : 'Copy Prompt'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setupDialogRef.current?.close();
                  appendLog(`${activeCli} > running onboarding prompt for missing dependencies...`);
                }}
                className="ql-press tf-btn tf-btn-prio"
              >
                <Play size={14} />
                <span>Run Prompt in {activeCli}</span>
              </button>
            </div>
          </div>
        )}

        {setupTab === 'manual' && (
          <div>
            <pre className="cli-log tabular" style={{ height: 112, marginBottom: 12, border: '1px solid rgba(255,255,255,0.16)' }}>
              {manualCommands}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleCopy('manual', manualCommands)}
                className="ql-press tf-btn"
                style={{ background: '#27272a', color: '#fafafa' }}
              >
                {copiedKey === 'manual' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey === 'manual' ? 'Copied' : 'Copy Commands'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setupDialogRef.current?.close();
                  appendLog('$ npm ci && python -m pip install numpy pillow && ffmpeg -version');
                }}
                className="ql-press tf-btn tf-btn-prio"
              >
                <Terminal size={14} />
                <span>Run Preflight in PTY</span>
              </button>
            </div>
          </div>
        )}

        {setupTab === 'walk' && (
          <div>
            <div className="walk-row">
              <span className="tf-badge tabular" style={{ background: '#047857', color: '#ffffff' }}>1</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Sync Template Repo &amp; Toolchain</div>
                <div style={{ fontSize: 12, color: '#d4d4d8' }}>Pull Remotion + Python scripts and verify FFmpeg &amp; Chromium.</div>
              </div>
            </div>
            <div className="walk-row">
              <span className="tf-badge tabular" style={{ background: '#27272a', color: '#fafafa' }}>2</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Configure Card, Rig &amp; VO / No-VO Mode</div>
                <div style={{ fontSize: 12, color: '#d4d4d8' }}>Pick Stickman or Chibi Sheet and tap the badge to queue renders.</div>
              </div>
            </div>
            <div className="walk-row">
              <span className="tf-badge tabular" style={{ background: '#27272a', color: '#fafafa' }}>3</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Auto-Queue 2K Render &amp; Short QA</div>
                <div style={{ fontSize: 12, color: '#d4d4d8' }}>Watch live -15 LUFS audio mix, 1440×2560 render, and QA checks.</div>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
