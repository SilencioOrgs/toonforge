import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentDock } from './components/AgentDock';
import { HowToPage, IntroPage, RequirementsPage, type InstallState } from './components/GuidePages';
import { LibraryPage } from './components/LibraryPage';
import { Sidebar } from './components/Sidebar';
import { LookPage, RenderPage, ScenesPage, ScriptPage, SoundPage, TopicPage, VoicePage } from './components/StepPages';
import * as backend from './lib/backend';
import {
  buildAiSetupPrompt,
  buildManualSetupCommands,
  errorMessage,
  generateScriptFromTopic,
  getTop10TopicsForNiche,
  NICHE_PRESETS,
  setCardRig,
  stripSfxTagsForVoiceover,
  toggleCardAudioMode,
  type BoardState,
  type CliEngine,
  type ContentNicheId,
  type EnvStatus,
  type RigMode,
  type RigSummary,
  type ScriptLanguage,
  type TopicIdea,
} from './lib/domain';
import { nextStep, type PageId } from './lib/pipeline';

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

const EMPTY_BOARD: BoardState = { version: 1, autoQueue: true, activeLane: 'queued', selectedCardId: '', cards: [] };
const VIDEO_REQ_IDS = new Set(['git', 'node', 'python', 'py_deps', 'ffmpeg', 'chromium']);
const AGENT_IDS = new Set(['claude', 'codex', 'opencode', 'agy']);

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [page, setPage] = useState<PageId>('intro');
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [checkingEnv, setCheckingEnv] = useState(false);
  const [installs, setInstalls] = useState<Record<string, InstallState>>({});
  const [rigs, setRigs] = useState<RigSummary | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [busyAction, setBusyAction] = useState<'stills' | 'render' | 'typecheck' | null>(null);

  // Agent dock
  const [dockOpen, setDockOpen] = useState(false);
  const [activeCli, setActiveCli] = useState<CliEngine>('claude');
  const [cliInput, setCliInput] = useState('');
  const [cliRunning, setCliRunning] = useState(false);
  const [cliLogs, setCliLogs] = useState<string[]>(['Workspace connected. Output from ToonForge and your agent appears here.']);

  // Current short: a saved card, or an unsaved draft (draftTitle !== null)
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [scriptLang, setScriptLang] = useState<ScriptLanguage>('english');
  const [niche, setNiche] = useState<ContentNicheId>('crime');
  const [customNiche, setCustomNiche] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicIdea | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const appendLog = useCallback((line: string) => setCliLogs((prev) => [...prev.slice(-200), line]), []);

  useEffect(() => {
    let active = true;
    Promise.all([backend.getEnvStatus(), backend.getRigs(), backend.loadBoard()])
      .then(([envRes, rigRes, boardRes]) => {
        if (!active) return;
        setEnv(envRes);
        setRigs(rigRes);
        setBoard(boardRes);
      })
      .catch((err: unknown) => active && appendLog(`Could not read the workspace: ${errorMessage(err)}`))
      .finally(() => active && setLoadingBoard(false));
    return () => {
      active = false;
    };
  }, [appendLog]);

  const isDraft = draftTitle !== null;
  const savedCard = useMemo(() => board.cards.find((c) => c.id === board.selectedCardId) ?? board.cards[0], [board]);
  const card = isDraft ? undefined : savedCard;

  // Load the saved short's script whenever the current short changes.
  useEffect(() => {
    if (!card) return;
    let active = true;
    setScriptLoading(true);
    setSaveState('idle');
    backend
      .getCardScript(card.slug)
      .then((doc) => active && setScriptText(doc.content))
      .catch((err: unknown) => active && appendLog(`Could not load the script for ${card.slug}: ${errorMessage(err)}`))
      .finally(() => active && setScriptLoading(false));
    return () => {
      active = false;
    };
  }, [card?.slug, appendLog]);

  const persistBoard = (next: BoardState) => {
    setBoard(next);
    backend.saveBoard(next).catch((err: unknown) => appendLog(`Could not save the board: ${errorMessage(err)}`));
  };

  const refreshBoard = () => backend.loadBoard().then(setBoard).catch(() => undefined);

  const probes = env?.probes ?? [];
  const videoReqs = probes.filter((p) => VIDEO_REQ_IDS.has(p.id));
  const agentProbes = probes.filter((p) => AGENT_IDS.has(p.id));
  const skillProbe = probes.find((p) => p.id === 'skill');
  const reqReady =
    videoReqs.filter((p) => p.installed).length + (agentProbes.some((p) => p.installed) ? 1 : 0) + (skillProbe?.installed ? 1 : 0);
  const reqTotal = videoReqs.length + (agentProbes.length > 0 ? 1 : 0) + (skillProbe ? 1 : 0);

  const topics = useMemo(() => getTop10TopicsForNiche(niche, customNiche, scriptLang), [niche, customNiche, scriptLang]);
  const draftRig: RigMode = NICHE_PRESETS.find((p) => p.id === niche)?.recommendedRig ?? 'chibi';

  const sendToAgent = (text: string) => {
    setCliInput(text);
    setDockOpen(true);
  };

  const startNewShort = () => {
    setDraftTitle('');
    setSelectedTopic(null);
    setScriptText('');
    setSaveState('idle');
    setUploadStatus(null);
    setPage('topic');
  };

  const selectCard = (cardId: string, goNext = false) => {
    if (cardId === '__draft') return;
    setDraftTitle(null);
    setUploadStatus(null);
    persistBoard({ ...board, selectedCardId: cardId });
    if (goNext) setPage(nextStep(board.cards.find((c) => c.id === cardId)));
  };

  const handleSelectTopic = (topic: TopicIdea) => {
    setSelectedTopic(topic);
    setDraftTitle(topic.title);
    setScriptText(generateScriptFromTopic(topic, scriptLang, draftRig));
    setSaveState('idle');
    setPage('script');
  };

  const handleDraftLanguage = (lang: ScriptLanguage) => {
    setScriptLang(lang);
    if (!selectedTopic) return;
    const match = getTop10TopicsForNiche(niche, customNiche, lang).find((t) => t.rank === selectedTopic.rank);
    if (match) {
      setSelectedTopic(match);
      setScriptText(generateScriptFromTopic(match, lang, draftRig));
    }
  };

  const handleSaveScript = async () => {
    setSaveState('saving');
    try {
      if (isDraft) {
        const title = draftTitle?.trim() || `Short ${board.cards.length + 1}`;
        const next = await backend.createCard(title, draftRig, scriptText);
        // The bridge prepends the new card; make it the current short.
        setBoard({ ...next, selectedCardId: next.cards[0]?.id ?? next.selectedCardId });
        setDraftTitle(null);
        appendLog(`Saved new short "${title}" as ${next.cards[0]?.scriptFile ?? 'a script file'}.`);
        setPage('voice');
      } else if (card) {
        const saved = await backend.saveCardScript(card.slug, scriptText);
        appendLog(`Saved ${saved.file}.`);
      }
      setSaveState('saved');
    } catch (err: unknown) {
      setSaveState('error');
      appendLog(`Script save failed: ${errorMessage(err)}`);
    }
  };

  const handleUpload = async (file: File) => {
    if (!card) return;
    try {
      const next = await backend.uploadVoiceover(card.slug, file.name, await fileToBase64(file));
      setBoard(next);
      setUploadStatus({ kind: 'ok', text: `Attached ${file.name}.` });
      appendLog(`Voice file ${file.name} attached to ${card.slug}.`);
    } catch (err: unknown) {
      setUploadStatus({ kind: 'error', text: `Upload failed: ${errorMessage(err)}. Check the file is a .wav or .mp3 and try again.` });
    }
  };

  const handleNoVoice = () => {
    if (!card) return;
    persistBoard({
      ...board,
      cards: board.cards.map((c) =>
        c.id === card.id ? { ...c, audioMode: 'no_vo' as const, lane: board.autoQueue && c.lane === 'backlog' ? ('queued' as const) : c.lane } : c,
      ),
    });
  };

  const runAction = async (action: 'stills' | 'render' | 'typecheck') => {
    if (!card) return;
    setBusyAction(action);
    appendLog(`Running ${action} for ${card.slug}...`);
    try {
      const res = await backend.runPipeline(card.slug, action);
      res.lines.forEach((l) => appendLog(l));
      appendLog(res.ok ? `${action} finished.` : `${action} reported problems. Read the lines above.`);
      if (!res.ok) setDockOpen(true);
      await refreshBoard();
    } catch (err: unknown) {
      appendLog(`${action} failed: ${errorMessage(err)}`);
      setDockOpen(true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSync = async () => {
    setSyncState('busy');
    try {
      const res = await backend.syncRepo();
      res.lines.forEach((l) => appendLog(`git: ${l}`));
      setSyncState(res.ok ? 'ok' : 'error');
      if (res.ok) await refreshBoard();
    } catch (err: unknown) {
      setSyncState('error');
      appendLog(`git sync failed: ${errorMessage(err)}`);
    }
  };

  const recheckEnv = async (): Promise<EnvStatus | null> => {
    setCheckingEnv(true);
    try {
      const next = await backend.getEnvStatus();
      setEnv(next);
      return next;
    } catch (err: unknown) {
      appendLog(`Requirement check failed: ${errorMessage(err)}`);
      return null;
    } finally {
      setCheckingEnv(false);
    }
  };

  const setInstall = (id: string, s: InstallState) => setInstalls((prev) => ({ ...prev, [id]: s }));

  const installOne = async (id: string): Promise<void> => {
    setInstall(id, { state: 'busy', text: 'Downloading and installing. This can take a few minutes.' });
    appendLog(`Installing ${id}...`);
    try {
      const res = await backend.installTool(id);
      res.lines.forEach((l) => appendLog(`${id}: ${l}`));
      if (!res.ok) {
        setInstall(id, { state: 'error', text: res.lines.at(-1) ?? 'The installer failed. Open the agent terminal for details.' });
        return;
      }
      const next = await recheckEnv();
      const found = next?.probes.find((p) => p.id === id)?.installed;
      // A fresh install often only lands on PATH for newly started programs.
      setInstall(id, found ? { state: 'done' } : { state: 'done', text: 'Installed. Restart ToonForge if it still shows as missing.' });
    } catch (err: unknown) {
      setInstall(id, { state: 'error', text: errorMessage(err) });
    }
  };

  const installAll = async (ids: string[]) => {
    for (const id of ids) await installOne(id); // one at a time: installers share winget/npm locks
  };

  const runShell = async (cmd: string) => {
    setDockOpen(true);
    appendLog(`$ ${cmd}`);
    try {
      const res = await backend.execCliCommand('shell', cmd);
      appendLog((res.stdout || res.stderr || 'No output.').trim());
    } catch (err: unknown) {
      appendLog(`Command failed: ${errorMessage(err)}`);
    }
  };

  const handleCliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd || cliRunning) return;
    setCliInput('');
    setCliRunning(true);
    appendLog(`${activeCli} > ${cmd}`);
    try {
      const res = await backend.execCliCommand(activeCli, cmd);
      if (res.stdout.trim()) appendLog(res.stdout.trim());
      if (res.stderr.trim()) appendLog(`stderr: ${res.stderr.trim()}`);
      await refreshBoard();
    } catch (err: unknown) {
      appendLog(`${activeCli} failed: ${errorMessage(err)}`);
    } finally {
      setCliRunning(false);
    }
  };

  const narration = useMemo(() => stripSfxTagsForVoiceover(scriptText), [scriptText]);
  const nav = (p: PageId) => setPage(p);

  let content: React.ReactNode;
  switch (page) {
    case 'intro':
      content = <IntroPage reqReady={reqReady} reqTotal={reqTotal} onNavigate={nav} onStart={startNewShort} />;
      break;
    case 'howto':
      content = <HowToPage repoRoot={env?.repoRoot} onNavigate={nav} />;
      break;
    case 'requirements':
      content = (
        <RequirementsPage
          videoReqs={videoReqs}
          agentProbes={agentProbes}
          skillProbe={skillProbe}
          installs={installs}
          aiSetupPrompt={buildAiSetupPrompt(activeCli, probes)}
          manualCommands={buildManualSetupCommands(probes)}
          checking={checkingEnv}
          onRecheck={recheckEnv}
          onInstall={installOne}
          onInstallAll={installAll}
          onSendToAgent={sendToAgent}
          onVerify={() => runShell('git --version && node -v && python --version && ffmpeg -version')}
        />
      );
      break;
    case 'library':
      content = (
        <LibraryPage
          board={board}
          loading={loadingBoard}
          currentId={card?.id}
          onSelectLane={(lane) => persistBoard({ ...board, activeLane: lane })}
          onOpenCard={(id) => selectCard(id, true)}
          onToggleAudio={(id) => persistBoard(toggleCardAudioMode(board, id))}
          onToggleAutoQueue={() => persistBoard({ ...board, autoQueue: !board.autoQueue })}
          onNewShort={startNewShort}
        />
      );
      break;
    case 'topic':
      content = (
        <TopicPage
          language={scriptLang}
          niche={niche}
          customNiche={customNiche}
          topics={topics}
          onLanguageChange={setScriptLang}
          onNicheChange={setNiche}
          onCustomNicheChange={setCustomNiche}
          onSelectTopic={handleSelectTopic}
          onSend={sendToAgent}
        />
      );
      break;
    case 'script':
      content = (
        <ScriptPage
          card={card}
          isDraft={isDraft}
          title={draftTitle ?? card?.title ?? ''}
          text={scriptText}
          loading={scriptLoading && !isDraft}
          saveState={saveState}
          language={scriptLang}
          canRelocalize={Boolean(selectedTopic)}
          onTitleChange={setDraftTitle}
          onTextChange={(v) => {
            setScriptText(v);
            if (saveState !== 'idle') setSaveState('idle');
          }}
          onLanguageChange={handleDraftLanguage}
          onSave={handleSaveScript}
          onSend={sendToAgent}
          onNavigate={nav}
        />
      );
      break;
    case 'voice':
      content = (
        <VoicePage
          card={card}
          narration={narration}
          uploadStatus={uploadStatus}
          getMediaUrl={backend.mediaUrl}
          onUpload={handleUpload}
          onNoVoice={handleNoVoice}
          onSend={sendToAgent}
          onNavigate={nav}
        />
      );
      break;
    case 'scenes':
      content = (
        <ScenesPage
          card={card}
          rigs={rigs}
          busy={busyAction === 'typecheck'}
          getMediaUrl={backend.mediaUrl}
          onRigChange={(rig) => card && persistBoard(setCardRig(board, card.id, rig))}
          onTypecheck={() => runAction('typecheck')}
          onSend={sendToAgent}
          onNavigate={nav}
        />
      );
      break;
    case 'sound':
      content = <SoundPage card={card} getMediaUrl={backend.mediaUrl} onSend={sendToAgent} onNavigate={nav} />;
      break;
    case 'look':
      content = (
        <LookPage card={card} busy={busyAction === 'stills'} getMediaUrl={backend.mediaUrl} onRunStills={() => runAction('stills')} onSend={sendToAgent} onNavigate={nav} />
      );
      break;
    case 'render':
      content = (
        <RenderPage card={card} busy={busyAction === 'render'} getMediaUrl={backend.mediaUrl} onRender={() => runAction('render')} onSend={sendToAgent} onNavigate={nav} />
      );
      break;
  }

  return (
    <div id="studio-frame" data-mode={theme} className={dockOpen ? 'has-dock' : undefined}>
      <Sidebar
        page={page}
        cards={board.cards}
        currentCard={card}
        draftTitle={draftTitle}
        reqReady={reqReady}
        reqTotal={reqTotal}
        branch={env?.branch}
        syncState={syncState}
        theme={theme}
        dockOpen={dockOpen}
        onNavigate={nav}
        onSelectCard={(id) => selectCard(id)}
        onNewShort={startNewShort}
        onSync={handleSync}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onToggleDock={() => setDockOpen((o) => !o)}
      />
      <main className="main" key={page}>
        {content}
      </main>
      {dockOpen && (
        <AgentDock
          activeCli={activeCli}
          probes={probes}
          input={cliInput}
          logs={cliLogs}
          running={cliRunning}
          onSelectCli={setActiveCli}
          onInputChange={setCliInput}
          onSubmit={handleCliSubmit}
          onClose={() => setDockOpen(false)}
        />
      )}
    </div>
  );
}
