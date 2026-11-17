import { useEffect, useMemo, useRef, useState } from 'react';
import { ContentBankPane } from './components/ContentBankPane';
import { IconPickerDialog } from './components/IconPickerDialog';
import { PipelineAndCliPane } from './components/PipelineAndCliPane';
import { SetupWizardDialog } from './components/SetupWizardDialog';
import { StageInspectorPane, type StageTab } from './components/StageInspectorPane';
import { TopBar } from './components/TopBar';
import * as backend from './lib/backend';
import {
  AI_PROVIDER_GUIDES,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  buildVideoStepPrompt,
  errorMessage,
  setCardRig,
  toggleCardAudioMode,
  type BoardState,
  type CliEngine,
  type EnvStatus,
  type LogoConcept,
  type RigMode,
  type RigSummary,
  type VideoStep,
} from './lib/domain';

const INITIAL_EMPTY_BOARD: BoardState = {
  version: 1,
  autoQueue: true,
  activeLane: 'queued',
  selectedCardId: '',
  cards: [],
};

const VIDEO_REQ_IDS = new Set(['git', 'node', 'python', 'py_deps', 'ffmpeg', 'chromium']);

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeLogo, setActiveLogo] = useState<LogoConcept>('cube');
  const [board, setBoard] = useState<BoardState>(INITIAL_EMPTY_BOARD);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [rigs, setRigs] = useState<RigSummary | null>(null);
  const [syncLabel, setSyncLabel] = useState('Sync Repo');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [stageView, setStageView] = useState<StageTab>('rig');
  const [activeCli, setActiveCli] = useState<CliEngine>('agy');
  const [cliInput, setCliInput] = useState('');
  const [cliLogs, setCliLogs] = useState<string[]>([
    'workspace bridge online · scanning SCRIPT_*.md, voice/, and out/',
  ]);
  const [pctOverride, setPctOverride] = useState<number | null>(null);
  const [qaOverride, setQaOverride] = useState<'QA Next' | 'QA Pass' | null>(null);
  const [setupTab, setSetupTab] = useState<'ai' | 'manual' | 'walk'>('ai');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const logoDialogRef = useRef<HTMLDialogElement>(null);
  const setupDialogRef = useRef<HTMLDialogElement>(null);

  const appendLog = (line: string) => {
    setCliLogs((prev) => [...prev.slice(-24), line]);
  };

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
      .catch((err: unknown) => {
        if (!active) return;
        setLoadingBoard(false);
        appendLog(`startup error > ${errorMessage(err)}`);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistBoard = (next: BoardState) => {
    setBoard(next);
    backend.saveBoard(next).catch((err: unknown) => {
      appendLog(`board save error > ${errorMessage(err)}`);
    });
  };

  const selectedCard = useMemo(
    () => board.cards.find((c) => c.id === board.selectedCardId) ?? board.cards[0],
    [board],
  );

  const probes = env?.probes ?? [];
  const videoReqs = useMemo(() => probes.filter((p) => VIDEO_REQ_IDS.has(p.id)), [probes]);
  const aiSetupPrompt = useMemo(() => buildAiSetupPrompt(activeCli, probes), [activeCli, probes]);
  const manualCommands = useMemo(() => buildManualSetupCommands(probes), [probes]);

  const handleSync = async () => {
    setSyncLabel('Syncing...');
    try {
      const res = await backend.syncRepo();
      setSyncLabel(res.ok ? 'Repo Ready' : 'Sync Err');
      res.lines.forEach((l) => appendLog(`git > ${l}`));
    } catch (err: unknown) {
      setSyncLabel('Sync Err');
      appendLog(`git error > ${errorMessage(err)}`);
    }
  };

  const handleCreateCard = async () => {
    const title = newCardTitle.trim() || `Short ${board.cards.length + 1}`;
    setNewCardTitle('');
    try {
      const next = await backend.createCard(title, selectedCard?.rigMode ?? 'chibi');
      setBoard(next);
      const createdFile = next.cards[0]?.scriptFile ?? 'SCRIPT.md';
      appendLog(`board > created card "${title}" + ${createdFile}`);
    } catch (err: unknown) {
      appendLog(`create card error > ${errorMessage(err)}`);
    }
  };

  const handleRigChange = (rig: RigMode) => {
    if (!selectedCard) return;
    persistBoard(setCardRig(board, selectedCard.id, rig));
    appendLog(`${activeCli} > ${selectedCard.slug} rig set to ${rig === 'stickman' ? 'Built-in Stickman rig' : 'Custom Chibi sprite sheet'}`);
  };

  const handleStills = async () => {
    if (!selectedCard) return;
    setStageView('stills');
    try {
      const res = await backend.runPipeline(selectedCard.slug, 'stills');
      res.lines.forEach((l) => appendLog(`stills > ${l}`));
    } catch (err: unknown) {
      appendLog(`stills error > ${errorMessage(err)}`);
    }
  };

  const handleRunQa = async () => {
    if (!selectedCard) return;
    try {
      const res = await backend.runPipeline(selectedCard.slug, 'render');
      if (res.completionPct !== undefined) setPctOverride(res.completionPct);
      setQaOverride(res.ok ? 'QA Pass' : 'QA Next');
      res.lines.forEach((l) => appendLog(`pipeline > ${l}`));
    } catch (err: unknown) {
      setQaOverride('QA Next');
      appendLog(`pipeline error > ${errorMessage(err)}`);
    }
  };

  const handleVerifyTypecheck = async () => {
    appendLog('tsc > running npx tsc --noEmit...');
    try {
      const res = await backend.runPipeline(selectedCard?.slug || 'workspace', 'typecheck');
      res.lines.forEach((l) => appendLog(`tsc > ${l}`));
    } catch (err: unknown) {
      appendLog(`tsc error > ${errorMessage(err)}`);
    }
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
    try {
      const res = await backend.execCliCommand(activeCli, cmd);
      if (res.stdout.trim()) appendLog(res.stdout.trim());
      if (res.stderr.trim()) appendLog(`stderr: ${res.stderr.trim()}`);
    } catch (err: unknown) {
      appendLog(`cli error > ${errorMessage(err)}`);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
  };

  return (
    <div id="studio-frame" data-mode={theme}>
      <TopBar
        theme={theme}
        activeLogo={activeLogo}
        syncLabel={syncLabel}
        onSelectLogo={setActiveLogo}
        onOpenCompare={() => logoDialogRef.current?.showModal()}
        onOpenSetup={() => setupDialogRef.current?.showModal()}
        onSyncRepo={handleSync}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <div className="tf-grid">
        <ContentBankPane
          board={board}
          loading={loadingBoard}
          selectedCard={selectedCard}
          newCardTitle={newCardTitle}
          onNewCardTitleChange={setNewCardTitle}
          onCreateCard={handleCreateCard}
          onToggleAutoQueue={() => persistBoard({ ...board, autoQueue: !board.autoQueue })}
          onSelectLane={(lane) => persistBoard({ ...board, activeLane: lane })}
          onSelectCard={(cardId) => {
            setPctOverride(null);
            setQaOverride(null);
            persistBoard({ ...board, selectedCardId: cardId });
          }}
          onToggleCardMode={(cardId) => persistBoard(toggleCardAudioMode(board, cardId))}
        />

        <StageInspectorPane
          selectedCard={selectedCard}
          rigs={rigs}
          branch={env?.branch}
          stageView={stageView}
          getMediaUrl={backend.mediaUrl}
          onLoadScript={backend.getCardScript}
          onSaveScript={backend.saveCardScript}
          onChangeStageView={setStageView}
          onChangeRig={handleRigChange}
          onCheckStills={handleStills}
          onRunQa={handleRunQa}
          onAppendLog={appendLog}
        />

        <PipelineAndCliPane
          selectedCard={selectedCard}
          qaOverride={qaOverride}
          pctOverride={pctOverride}
          activeCli={activeCli}
          probes={probes}
          cliInput={cliInput}
          cliLogs={cliLogs}
          onCliInputChange={setCliInput}
          onSelectCli={(cli) => {
            setActiveCli(cli);
            appendLog(`${cli} > selected (${AI_PROVIDER_GUIDES[cli].accountReq})`);
          }}
          onCopyOrPrepareCli={(cmdText, key) => {
            setCliInput(cmdText);
            handleCopy(key, cmdText);
          }}
          onSubmitCli={handleCliSubmit}
          onGuidedStep={handleGuidedStep}
          onVerifyTypecheck={handleVerifyTypecheck}
        />
      </div>

      <IconPickerDialog dialogRef={logoDialogRef} activeLogo={activeLogo} onSelectLogo={setActiveLogo} />

      <SetupWizardDialog
        dialogRef={setupDialogRef}
        videoReqs={videoReqs}
        setupTab={setupTab}
        activeCli={activeCli}
        aiSetupPrompt={aiSetupPrompt}
        manualCommands={manualCommands}
        copiedKey={copiedKey}
        onChangeTab={setSetupTab}
        onCopy={handleCopy}
        onLoadPromptInCli={() => {
          setupDialogRef.current?.close();
          setCliInput(aiSetupPrompt);
          appendLog(`${activeCli} > loaded video-stack setup prompt`);
        }}
        onVerifyVideoStack={async () => {
          setupDialogRef.current?.close();
          try {
            const res = await backend.execCliCommand('shell', 'node -v && python --version && ffmpeg -version');
            appendLog(res.stdout || res.stderr || 'preflight checked');
          } catch (err: unknown) {
            appendLog(`preflight error > ${errorMessage(err)}`);
          }
        }}
      />
    </div>
  );
}
