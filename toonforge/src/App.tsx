import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Clock,
  Copy,
  Film,
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
  AI_PROVIDER_GUIDES,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  buildVideoStepPrompt,
  setCardRig,
  toggleCardAudioMode,
  type BoardState,
  type CliEngine,
  type EnvStatus,
  type LaneId,
  type LogoConcept,
  type RigMode,
  type RigSummary,
  type VideoStep,
} from './lib/domain';

const EMPTY_BOARD: BoardState = {
  version: 1,
  autoQueue: true,
  activeLane: 'queued',
  selectedCardId: '',
  cards: [],
};

const CLI_ENGINES: { label: string; cmd: CliEngine }[] = [
  { label: 'Antigravity', cmd: 'agy' },
  { label: 'Claude', cmd: 'claude' },
  { label: 'Codex', cmd: 'codex' },
  { label: 'OpenCode', cmd: 'opencode' },
];

const VIDEO_REQ_IDS = new Set(['git', 'node', 'python', 'py_deps', 'ffmpeg', 'chromium']);

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeLogo, setActiveLogo] = useState<LogoConcept>('cube');
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [rigs, setRigs] = useState<RigSummary | null>(null);
  const [syncLabel, setSyncLabel] = useState('Sync Repo');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [stageView, setStageView] = useState<'rig' | 'video' | 'stills'>('rig');
  const [activeCli, setActiveCli] = useState<CliEngine>('agy');
  const [cliInput, setCliInput] = useState('');
  const [cliLogs, setCliLogs] = useState<string[]>([
    'workspace bridge online · scanning real SCRIPT_*.md, voice/, and out/',
  ]);
  const [renderPct, setRenderPct] = useState<number | null>(null);
  const [qaStatus, setQaStatus] = useState<'QA Next' | 'QA Pass'>('QA Next');
  const [setupTab, setSetupTab] = useState<'ai' | 'manual' | 'walk'>('ai');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        setLoadingBoard(false);
      })
      .catch(() => {
        if (active) setLoadingBoard(false);
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
  const videoReqs = useMemo(() => probes.filter((p) => VIDEO_REQ_IDS.has(p.id)), [probes]);
  const activeCliProbe = useMemo(() => probes.find((p) => p.id === activeCli), [probes, activeCli]);
  const activeAiGuide = AI_PROVIDER_GUIDES[activeCli];

  const aiSetupPrompt = useMemo(() => buildAiSetupPrompt(activeCli, probes), [activeCli, probes]);
  const manualCommands = useMemo(() => buildManualSetupCommands(probes), [probes]);

  const appendLog = (line: string) => {
    setCliLogs((prev) => [...prev.slice(-24), line]);
  };

  const handleSync = async () => {
    setSyncLabel('Syncing...');
    const res = await backend.syncRepo();
    setSyncLabel(res.ok ? 'Repo Ready' : 'Sync Err');
    res.lines.forEach((l) => appendLog(`git > ${l}`));
  };

  const handleCreateCard = async () => {
    const title = newCardTitle.trim() || `Short ${board.cards.length + 1}`;
    setNewCardTitle('');
    const next = await backend.createCard(title, selectedCard?.rigMode ?? 'chibi');
    setBoard(next);
    appendLog(`board > created card "${title}" + SCRIPT_${title.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase()}.md`);
  };

  const handleRigChange = (rig: RigMode) => {
    if (!selectedCard) return;
    persistBoard(setCardRig(board, selectedCard.id, rig));
    appendLog(`${activeCli} > ${selectedCard.slug} rig set to ${rig === 'stickman' ? 'Built-in Stickman rig' : 'Custom Chibi sprite sheet'}`);
  };

  const handleStills = async () => {
    if (!selectedCard) return;
    setStageView('stills');
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
    res.lines.forEach((l) => appendLog(`pipeline > ${l}`));
  };

  const handleGuidedStep = (step: VideoStep) => {
    if (!selectedCard) return;
    const prompt = buildVideoStepPrompt(step, selectedCard, activeCli);
    setCliInput(prompt);
    appendLog(prompt);
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

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
  };

  const effectivePct =
    renderPct !== null ? renderPct : selectedCard?.lane === 'done' ? 100 : selectedCard?.voiceFile ? 68 : 25;
  const effectiveQa = selectedCard?.qaReport ? 'QA Pass' : qaStatus;

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
              <span className="tf-logo-mini">
                <LogoSvg concept={logo} />
              </span>
              <span>{logo.charAt(0).toUpperCase() + logo.slice(1)}</span>
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
          <button type="button" onClick={handleSync} className="ql-surface ql-clear ql-press tf-btn">
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
        {/* LEFT PANE: Real Workspace Content Bank + Auto-Queue */}
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
              {loadingBoard && (
                <div className="text-sec" style={{ padding: 12, fontSize: 12 }}>
                  Scanning workspace shorts &amp; QA reports...
                </div>
              )}
              {!loadingBoard && visibleCards.length === 0 && (
                <div className="text-sec" style={{ padding: 12, fontSize: 12 }}>
                  No cards in {board.activeLane}. Add a new short below or toggle a card badge.
                </div>
              )}
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
                    onClick={() => {
                      setRenderPct(null);
                      persistBoard({ ...board, selectedCardId: card.id });
                    }}
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
                          persistBoard(toggleCardAudioMode(board, card.id));
                        }}
                        className="tf-badge ql-press"
                        style={{ ...badgeStyle, cursor: 'pointer' }}
                      >
                        {card.audioMode === 'no_vo' ? <VolumeX size={12} /> : <Mic size={12} />}
                        <span>{badgeText}</span>
                      </button>
                      <span className="text-sec tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {card.loudness || card.durationLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: '1px solid var(--g-divider)' }}>
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="New short title..."
              className="cli-input"
              style={{ padding: '6px 10px' }}
            />
            <button type="button" onClick={handleCreateCard} className="ql-surface ql-thin ql-press tf-btn">
              <Plus size={13} />
              <span>Add Card</span>
            </button>
          </div>
        </section>

        {/* CENTER PANE: Character Rig Switcher + Real Stage / Video / Stills Viewer */}
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
              onClick={() => setStageView('rig')}
              className={`tf-tab ql-press ${stageView === 'rig' ? 'is-active' : ''}`}
            >
              <Sparkles size={13} />
              <span>Rig</span>
            </button>
            <button
              type="button"
              onClick={() => setStageView('video')}
              className={`tf-tab ql-press ${stageView === 'video' ? 'is-active' : ''}`}
            >
              <Film size={13} />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => setStageView('stills')}
              className={`tf-tab ql-press ${stageView === 'stills' ? 'is-active' : ''}`}
            >
              <Camera size={13} />
              <span>Stills</span>
            </button>
          </div>

          <div className="tf-tab-strip" style={{ borderBottom: 'none', paddingBottom: 0 }}>
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
                {selectedCard?.compositionId ?? 'Workspace'}
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

            {stageView === 'rig' && <StageSvg rigMode={selectedCard?.rigMode ?? 'chibi'} />}

            {stageView === 'video' &&
              (selectedCard?.videoFile ? (
                <video
                  controls
                  playsInline
                  src={backend.mediaUrl(selectedCard.videoFile)}
                  className="stage-video"
                />
              ) : (
                <div style={{ fontSize: 12, color: '#d4d4d8', textAlign: 'center', padding: '24px 8px' }}>
                  No rendered MP4 yet for {selectedCard?.slug ?? 'this card'}. Use Step 4 or click Render.
                </div>
              ))}

            {stageView === 'stills' &&
              (selectedCard?.stills && selectedCard.stills.length > 0 ? (
                <div className="stills-grid">
                  {selectedCard.stills.map((imgPath) => (
                    <img
                      key={imgPath}
                      src={backend.mediaUrl(imgPath)}
                      alt={imgPath}
                      className="still-thumb"
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#d4d4d8', textAlign: 'center', padding: '24px 8px' }}>
                  No stills found in out/{selectedCard?.slug ?? ''}/stills yet.
                </div>
              ))}

            <div className="stage-actions">
              <button type="button" onClick={handleStills} className="pill-light ql-press">
                <Camera size={13} />
                <span>Check Stills</span>
              </button>
              <button type="button" onClick={handleRender} className="pill-prio ql-press">
                <Play size={13} />
                <span>Run QA</span>
              </button>
            </div>
          </div>

          <div className="text-sec tabular" style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>{rigs ? `Chibi: ${rigs.chibi.sprites} sprites · ${rigs.chibi.faces} faces` : 'Inspecting rigs...'}</span>
            <span>{env?.branch ? `git:${env.branch}` : 'git:main'}</span>
          </div>
        </section>

        {/* RIGHT PANE: Real Pipeline Telemetry + Easy AI CLI Hub */}
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
                {selectedCard?.loudness || `${effectivePct}%`}
              </span>
            </div>

            <div className="pipe-grid tabular">
              <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
                {selectedCard?.audioMode === 'no_vo' ? 'Visual Beat' : selectedCard?.voiceFile ? 'VO Found' : 'VO Wait'}
              </div>
              <div className="pipe-step text-sec" style={{ background: 'var(--g-sub)' }}>
                {selectedCard?.loudness || (selectedCard?.mixScript ? 'DSP Mix' : 'Mix Wait')}
              </div>
              <div className="pipe-step" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }}>
                {selectedCard?.videoFile ? '2K MP4' : `2K ${effectivePct}%`}
              </div>
              <div
                className="pipe-step"
                style={{
                  background: effectiveQa === 'QA Pass' ? 'var(--g-prio-bg)' : 'var(--g-sub)',
                  color: effectiveQa === 'QA Pass' ? 'var(--g-prio)' : 'var(--g-sec)',
                }}
              >
                {effectiveQa}
              </div>
            </div>

            <div className="progress-track">
              <div style={{ height: '100%', width: `${effectivePct}%`, borderRadius: 9999, background: '#10b981', transition: 'width 0.3s ease' }} />
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
                      appendLog(`${engine.cmd} > selected (${AI_PROVIDER_GUIDES[engine.cmd].accountReq})`);
                    }}
                    className={`tf-tab ql-press ${activeCli === engine.cmd ? 'is-active' : ''}`}
                  >
                    {engine.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Account / Install Explainer for Non-Technical Creators */}
            <div className="ai-guide-bar">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{activeAiGuide.accountReq}</div>
                <div className="text-sec" style={{ fontSize: 12 }}>{activeAiGuide.summary}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!activeCliProbe?.installed) {
                    setCliInput(activeAiGuide.installCmd);
                    handleCopy('cli-install', activeAiGuide.installCmd);
                  } else {
                    handleCopy('cli-login', activeAiGuide.loginCmd);
                  }
                }}
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

            <form onSubmit={handleCliSubmit} className="cli-input-row">
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder={`Type command or click a Video Step below (${activeCli})...`}
                className="cli-input"
              />
              <button type="submit" className="tf-btn tf-btn-mono ql-press">
                Run
              </button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              <button type="button" onClick={() => handleGuidedStep('script')} className="ql-press tf-btn tf-btn-mono">
                1. Script
              </button>
              <button type="button" onClick={() => handleGuidedStep('audio')} className="ql-press tf-btn tf-btn-mono">
                2. Audio Mix
              </button>
              <button type="button" onClick={() => handleGuidedStep('scene')} className="ql-press tf-btn tf-btn-mono">
                3. 3D Scene
              </button>
              <button type="button" onClick={() => handleGuidedStep('render')} className="ql-press tf-btn tf-btn-prio">
                4. Render QA
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Choose ToonForge Icon Dialog with Live Context Samples */}
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
              onClick={() => setActiveLogo(item.id)}
              className={`pick-logo ql-press ${activeLogo === item.id ? 'is-active' : ''}`}
            >
              <div style={{ width: 52, height: 52, margin: '0 auto 8px auto' }}>
                <LogoSvg concept={item.id} />
              </div>
              <div className="font-display" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {item.name}
              </div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="sample-strip">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>Live Icon Sample</div>
          <div className="sample-row">
            <div className="sample-item">
              <div className="sample-dock-squircle">
                <LogoSvg concept={activeLogo} />
              </div>
              <span style={{ fontSize: 12, color: '#d4d4d8' }}>App Dock</span>
            </div>
            <div className="sample-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <span style={{ width: 18, height: 18, display: 'inline-block' }}>
                  <LogoSvg concept={activeLogo} />
                </span>
                <span className="font-display" style={{ fontSize: 12, fontWeight: 700 }}>ToonForge</span>
              </div>
              <span style={{ fontSize: 12, color: '#d4d4d8' }}>Window Titlebar</span>
            </div>
            <div className="sample-item">
              <div style={{ width: 34, height: 48, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 4, position: 'relative', background: '#18181b' }}>
                <span style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14 }}>
                  <LogoSvg concept={activeLogo} />
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#d4d4d8' }}>9:16 Short</span>
            </div>
          </div>
        </div>
      </dialog>

      {/* Video Creation Setup Guide & Walkthrough Dialog */}
      <dialog ref={setupDialogRef} className="tf-dialog">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Video Creation Stack — Needed to Create Videos
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

        <div className="req-list">
          {videoReqs.map((p) => (
            <div key={p.id} className="req-row">
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#d4d4d8' }}>{p.role}</div>
              </div>
              <button
                type="button"
                onClick={() => p.installCmd && handleCopy(`req-${p.id}`, p.installCmd)}
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
                  setCliInput(aiSetupPrompt);
                  appendLog(`${activeCli} > loaded video-stack setup prompt`);
                }}
                className="ql-press tf-btn tf-btn-prio"
              >
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
                onClick={() => handleCopy('manual', manualCommands)}
                className="ql-press tf-btn"
                style={{ background: '#27272a', color: '#fafafa' }}
              >
                {copiedKey === 'manual' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey === 'manual' ? 'Copied' : 'Copy Commands'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setupDialogRef.current?.close();
                  const res = await backend.execCliCommand('shell', 'node -v && python --version && ffmpeg -version');
                  appendLog(res.stdout || res.stderr || 'preflight checked');
                }}
                className="ql-press tf-btn tf-btn-prio"
              >
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
    </div>
  );
}
