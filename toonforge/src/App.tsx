import { useEffect, useMemo, useRef, useState } from 'react';
import { ContentBankPane } from './components/ContentBankPane';
import { IconPickerDialog } from './components/IconPickerDialog';
import { PipelineAndCliPane } from './components/PipelineAndCliPane';
import { SetupWizardDialog } from './components/SetupWizardDialog';
import { StageInspectorPane, type StageTab } from './components/StageInspectorPane';
import { StoryFlowWizard } from './components/StoryFlowWizard';
import { TopBar } from './components/TopBar';
import * as backend from './lib/backend';
import {
  AI_PROVIDER_GUIDES,
  buildAiSetupPrompt,
  buildManualSetupCommands,
  buildVideoStepPrompt,
  errorMessage,
  generateScriptFromTopic,
  getTop10TopicsForNiche,
  NICHE_PRESETS,
  SCRIPT_LANGUAGE_LABELS,
  setCardRig,
  toggleCardAudioMode,
  type BoardState,
  type CliEngine,
  type ContentNicheId,
  type EnvStatus,
  type LogoConcept,
  type RigMode,
  type RigSummary,
  type ScriptLanguage,
  type StoryFlowStep,
  type TopicIdea,
  type VideoStep,
} from './lib/domain';

async function fileToBase64(file: File): Promise<string> {
  if (typeof file.arrayBuffer === 'function') {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/i, ''));
    reader.onerror = () => reject(reader.error || new Error('Failed reading voiceover file'));
    reader.readAsDataURL(file);
  });
}

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

  const [viewMode, setViewMode] = useState<'flow' | 'workbench'>('flow');
  const [storyStep, setStoryStep] = useState<StoryFlowStep>('welcome');
  const [scriptLang, setScriptLang] = useState<ScriptLanguage>('taglish');
  const [niche, setNiche] = useState<ContentNicheId>('crime');
  const [customNiche, setCustomNiche] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicIdea | null>(null);
  const [scriptDraft, setScriptDraft] = useState('');
  const [flowRigMode, setFlowRigMode] = useState<RigMode>('chibi');
  const [flowCardSlug, setFlowCardSlug] = useState<string | null>(null);
  const [voUploadStatus, setVoUploadStatus] = useState('');
  const [cliStatusText, setCliStatusText] = useState('');

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

  const flowTopics = useMemo(
    () => getTop10TopicsForNiche(niche, customNiche, scriptLang),
    [niche, customNiche, scriptLang],
  );

  const flowCreatedCard = useMemo(
    () => (flowCardSlug ? board.cards.find((c) => c.slug === flowCardSlug) ?? null : null),
    [board.cards, flowCardSlug],
  );

  const handleFlowLanguageChange = (nextLang: ScriptLanguage) => {
    setScriptLang(nextLang);
    if (selectedTopic) {
      const updatedTopics = getTop10TopicsForNiche(niche, customNiche, nextLang);
      const matchingTopic = updatedTopics.find((t) => t.rank === selectedTopic.rank) ?? updatedTopics[0];
      setSelectedTopic(matchingTopic);
      setScriptDraft(generateScriptFromTopic(matchingTopic, nextLang, flowRigMode));
    }
  };

  const handleFlowSelectNiche = (chosenNiche: ContentNicheId) => {
    setNiche(chosenNiche);
    const preset = NICHE_PRESETS.find((p) => p.id === chosenNiche);
    if (preset) setFlowRigMode(preset.recommendedRig);
    setCliStatusText('');
    setStoryStep('topics');
  };

  const handleFlowSelectTopic = (topic: TopicIdea) => {
    setSelectedTopic(topic);
    setScriptDraft(generateScriptFromTopic(topic, scriptLang, flowRigMode));
    setVoUploadStatus('');
    setStoryStep('script');
  };

  const handleFlowRigChange = (rig: RigMode) => {
    setFlowRigMode(rig);
    if (selectedTopic) {
      setScriptDraft(generateScriptFromTopic(selectedTopic, scriptLang, rig));
    }
  };

  const handleAskAiTop10 = async (prompt: string) => {
    setCliStatusText(`Running ${activeCli} for fresh ${SCRIPT_LANGUAGE_LABELS[scriptLang]} Top 10 ideas...`);
    setCliInput(prompt);
    appendLog(`${activeCli} $ ${prompt}`);
    try {
      const res = await backend.execCliCommand(activeCli, prompt);
      const line = (res.stdout || res.stderr || 'Prompt queued for AI CLI').trim().split(/\r?\n/)[0];
      setCliStatusText(line);
      if (line) appendLog(line);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setCliStatusText(`Ready in CLI panel: ${msg}`);
      appendLog(`cli > ${msg}`);
    }
  };

  const handleSaveScriptAndContinue = async () => {
    const title = selectedTopic?.title || customNiche.trim() || `Short ${board.cards.length + 1}`;
    try {
      const next = await backend.createCard(title, flowRigMode, scriptDraft);
      setBoard(next);
      const created = next.cards[0];
      if (created) {
        setFlowCardSlug(created.slug);
        appendLog(`flow > saved ${created.scriptFile || 'SCRIPT.md'} (${SCRIPT_LANGUAGE_LABELS[scriptLang]})`);
      }
      setStoryStep('voiceover');
    } catch (err: unknown) {
      appendLog(`flow save error > ${errorMessage(err)}`);
    }
  };

  const handleUploadVoiceFile = async (file: File) => {
    const targetSlug = flowCardSlug || selectedCard?.slug;
    if (!targetSlug) {
      setVoUploadStatus('Save a script card first before attaching voiceover.');
      return;
    }
    try {
      const base64Data = await fileToBase64(file);
      const next = await backend.uploadVoiceover(targetSlug, file.name, base64Data);
      setBoard(next);
      setVoUploadStatus(`VO Attached: ${file.name} -> voice/${targetSlug}_voice${file.name.toLowerCase().endsWith('.mp3') ? '.mp3' : '.wav'}`);
      appendLog(`vo > uploaded ${file.name} for ${targetSlug} (autoQueue=${String(next.autoQueue)})`);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setVoUploadStatus(`Upload error: ${msg}`);
      appendLog(`vo error > ${msg}`);
    }
  };

  const handleSkipToNoVo = async () => {
    const targetCard = flowCreatedCard || selectedCard;
    if (targetCard) {
      const updated = {
        ...board,
        selectedCardId: targetCard.id,
        cards: board.cards.map((c) => {
          if (c.id !== targetCard.id) return c;
          const lane = board.autoQueue && c.lane === 'backlog' ? 'queued' : c.lane;
          return { ...c, audioMode: 'no_vo' as const, lane };
        }),
      };
      persistBoard(updated);
      setVoUploadStatus('No-VO Visual Mode active (Suno BGM / SFX timing).');
    }
  };

  return (
    <div id="studio-frame" data-mode={theme}>
      <TopBar
        theme={theme}
        activeLogo={activeLogo}
        viewMode={viewMode}
        syncLabel={syncLabel}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          if (mode === 'workbench' && flowCreatedCard) {
            setStageView('script');
          }
        }}
        onSelectLogo={setActiveLogo}
        onOpenCompare={() => logoDialogRef.current?.showModal()}
        onOpenSetup={() => setupDialogRef.current?.showModal()}
        onSyncRepo={handleSync}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      {viewMode === 'flow' ? (
        <StoryFlowWizard
          step={storyStep}
          language={scriptLang}
          niche={niche}
          customNiche={customNiche}
          topics={flowTopics}
          selectedTopic={selectedTopic}
          scriptDraft={scriptDraft}
          rigMode={flowRigMode}
          rigs={rigs}
          activeCli={activeCli}
          autoQueue={board.autoQueue}
          createdCard={flowCreatedCard}
          voUploadStatus={voUploadStatus}
          cliStatusText={cliStatusText}
          copiedKey={copiedKey}
          getMediaUrl={backend.mediaUrl}
          onStepChange={(nextStep) => {
            if (nextStep === 'studio') {
              setViewMode('workbench');
            } else {
              setStoryStep(nextStep);
            }
          }}
          onLanguageChange={handleFlowLanguageChange}
          onSelectNiche={handleFlowSelectNiche}
          onCustomNicheChange={setCustomNiche}
          onSelectTopic={handleFlowSelectTopic}
          onScriptChange={setScriptDraft}
          onRigModeChange={handleFlowRigChange}
          onAskAiTop10={handleAskAiTop10}
          onSaveScriptAndContinue={handleSaveScriptAndContinue}
          onUploadVoiceFile={handleUploadVoiceFile}
          onSkipToNoVo={handleSkipToNoVo}
          onEnterWorkbench={() => {
            if (flowCreatedCard) {
              persistBoard({
                ...board,
                activeLane: flowCreatedCard.lane,
                selectedCardId: flowCreatedCard.id,
              });
            }
            setViewMode('workbench');
          }}
          onCopy={handleCopy}
        />
      ) : (
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
      )}

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
