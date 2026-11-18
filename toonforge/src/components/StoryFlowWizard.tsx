import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  Check,
  Clapperboard,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  Ghost,
  Languages,
  ListOrdered,
  Mic,
  PenTool,
  ShieldAlert,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react';
import type {
  CardItem,
  CliEngine,
  ContentNicheId,
  RigMode,
  RigSummary,
  ScriptLanguage,
  StoryFlowStep,
  TopicIdea,
} from '../lib/domain';
import {
  AI_PROVIDER_GUIDES,
  NICHE_PRESETS,
  SCRIPT_LANGUAGE_LABELS,
  stripSfxTagsForVoiceover,
} from '../lib/domain';

interface StoryFlowWizardProps {
  step: StoryFlowStep;
  language: ScriptLanguage;
  niche: ContentNicheId;
  customNiche: string;
  topics: TopicIdea[];
  selectedTopic: TopicIdea | null;
  scriptDraft: string;
  rigMode: RigMode;
  rigs: RigSummary | null;
  activeCli: CliEngine;
  autoQueue: boolean;
  createdCard: CardItem | null;
  voUploadStatus: string;
  cliStatusText: string;
  copiedKey: string | null;
  getMediaUrl: (relPath: string) => string;
  onStepChange: (step: StoryFlowStep) => void;
  onLanguageChange: (lang: ScriptLanguage) => void;
  onSelectNiche: (niche: ContentNicheId) => void;
  onCustomNicheChange: (value: string) => void;
  onSelectTopic: (topic: TopicIdea) => void;
  onScriptChange: (value: string) => void;
  onRigModeChange: (rig: RigMode) => void;
  onAskAiTop10: (prompt: string) => void;
  onSaveScriptAndContinue: () => Promise<void>;
  onUploadVoiceFile: (file: File) => Promise<void>;
  onSkipToNoVo: () => Promise<void>;
  onEnterWorkbench: () => void;
  onCopy: (key: string, text: string) => void;
}

const STORY_STEPS: Array<{ id: StoryFlowStep; label: string; icon: typeof Sparkles }> = [
  { id: 'welcome', label: '1. Intro & Language', icon: Sparkles },
  { id: 'topics', label: '2. Topic Bank', icon: ListOrdered },
  { id: 'script', label: '3. Script Studio', icon: FileText },
  { id: 'voiceover', label: '4. ElevenLabs / VO', icon: AudioWaveform },
  { id: 'studio', label: '5. 3D Workbench', icon: Clapperboard },
];

const NICHE_CTA: Record<ContentNicheId, string> = {
  crime: 'Explore Crime Bank',
  horror: 'Explore Horror Bank',
  tech: 'Explore Tech Bank',
  custom: 'Build Custom Top 10',
};

function NicheIcon({ id }: { id: ContentNicheId }) {
  if (id === 'crime') return <ShieldAlert size={18} style={{ color: 'var(--g-prio)' }} />;
  if (id === 'horror') return <Ghost size={18} />;
  if (id === 'tech') return <Cpu size={18} />;
  return <PenTool size={18} style={{ color: 'var(--g-prio)' }} />;
}

const QUICK_SFX_TAGS = ['[SFX: SUB_DROP]', '[SFX: WHOOSH_IN]', '[SFX: CAMERA_FLASH]', '[SFX: HEARTBEAT_SLOW]'];
const WAVE_DELAYS = ['0s', '0.12s', '0.24s', '0.08s', '0.32s', '0.18s', '0.04s', '0.28s', '0.14s', '0.36s', '0.10s', '0.22s'];

export function StoryFlowWizard({
  step,
  language,
  niche,
  customNiche,
  topics,
  selectedTopic,
  scriptDraft,
  rigMode,
  rigs,
  activeCli,
  autoQueue,
  createdCard,
  voUploadStatus,
  cliStatusText,
  copiedKey,
  getMediaUrl,
  onStepChange,
  onLanguageChange,
  onSelectNiche,
  onCustomNicheChange,
  onSelectTopic,
  onScriptChange,
  onRigModeChange,
  onAskAiTop10,
  onSaveScriptAndContinue,
  onUploadVoiceFile,
  onSkipToNoVo,
  onEnterWorkbench,
  onCopy,
}: StoryFlowWizardProps) {
  const [savingScript, setSavingScript] = useState(false);
  const [uploadingVo, setUploadingVo] = useState(false);
  const voInputRef = useRef<HTMLInputElement>(null);

  const activeStepIdx = STORY_STEPS.findIndex((s) => s.id === step);
  const activePreset = NICHE_PRESETS.find((preset) => preset.id === niche) || NICHE_PRESETS[0];
  const fullTop10Prompt = `[${activeCli}] (${SCRIPT_LANGUAGE_LABELS[language]}) ${activePreset.top10Prompt}${niche === 'custom' && customNiche.trim() ? ` Subject: ${customNiche.trim()}` : ''}`;
  const cleanVoNarration = stripSfxTagsForVoiceover(scriptDraft);
  const cliGuide = AI_PROVIDER_GUIDES[activeCli];

  const handleSaveNext = async () => {
    setSavingScript(true);
    try {
      await onSaveScriptAndContinue();
    } finally {
      setSavingScript(false);
    }
  };

  const handleFileInput = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingVo(true);
    try {
      await onUploadVoiceFile(file);
    } finally {
      setUploadingVo(false);
    }
  };

  return (
    <div className="story-shell">
      <nav className="story-stepper ql-surface ql-thin" aria-label="Story Flow Steps">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {STORY_STEPS.map((item, idx) => {
            const Icon = item.icon;
            const isCurrent = item.id === step;
            const isDone = idx < activeStepIdx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.id === 'studio' ? onEnterWorkbench() : onStepChange(item.id))}
                className={`story-step-pill ${isCurrent ? 'is-active' : isDone ? 'is-done' : ''}`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onEnterWorkbench} className="tf-btn ql-surface ql-clear ql-press">
          <span>Skip to 3D Workbench</span>
          <ArrowRight size={13} />
        </button>
      </nav>

      {step === 'welcome' && (
        <>
          <section className="story-card-panel ql-surface ql-regular tf-fade-up">
            <div className="story-intro-hero">
              <div>
                <h1 className="font-display" style={{ margin: '0 0 8px 0', fontSize: 27, lineHeight: 1.2 }}>
                  Turn any niche idea into a 3D animated short.
                </h1>
                <p className="text-sec" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, maxWidth: '62ch' }}>
                  <strong>What is ToonForge?</strong> ToonForge is an open-source 2D-in-3D vertical video studio guiding creators from first topic hook to 2K MP4 render with ElevenLabs audio or No-VO beats.
                </p>
              </div>

              <div className="story-flow-nodes" aria-label="Creation Story Flow">
                <span className="story-node-pill">Language</span>
                <ArrowRight size={12} className="text-sec" />
                <span className="story-node-pill">Top 10 Niche</span>
                <ArrowRight size={12} className="text-sec" />
                <span className="story-node-pill">Script + SFX</span>
                <ArrowRight size={12} className="text-sec" />
                <span className="story-node-pill">ElevenLabs VO</span>
                <ArrowRight size={12} className="text-sec" />
                <span className="story-node-pill" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }}>
                  2K 3D Render
                </span>
              </div>
            </div>

            <div className="lang-bar">
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <Languages size={15} style={{ color: 'var(--g-prio)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                    Step 1 First Choice: Pick Script & Voiceover Language
                  </span>
                </div>
                <div className="text-sec" style={{ fontSize: 12, marginTop: 2 }}>
                  Every Topic Bank hook, generated script, and ElevenLabs narration draft adapts immediately.
                </div>
              </div>
              <div className="lang-pill-group" role="group" aria-label="Script Language">
                {(['taglish', 'tagalog', 'english'] as ScriptLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onLanguageChange(lang)}
                    className={`tf-tab ql-press ${language === lang ? 'is-active' : ''}`}
                  >
                    {SCRIPT_LANGUAGE_LABELS[lang]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="row" style={{ justifyContent: 'space-between', padding: '2px 4px' }}>
            <h2 className="font-display" style={{ margin: 0, fontSize: 18 }}>
              Choose a Starting Topic Card to Open Top 10 Bank
            </h2>
            <span className="text-sec" style={{ fontSize: 12 }}>
              Active Language: <strong>{SCRIPT_LANGUAGE_LABELS[language]}</strong>
            </span>
          </div>

          <div className="niche-grid">
            {NICHE_PRESETS.filter((preset) => preset.id !== 'custom').map((preset, idx) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectNiche(preset.id)}
                className={`niche-card ql-surface ql-regular tf-fade-up tf-stagger-${idx + 1} ${niche === preset.id ? 'is-selected' : ''}`}
              >
                <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <NicheIcon id={preset.id} />
                  <span className="tf-badge" style={{ background: 'var(--g-sub)', color: 'var(--g-sec)' }}>
                    {preset.recommendedRig === 'stickman' ? 'Stickman' : 'Chibi'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{preset.title}</div>
                  <div className="text-sec" style={{ fontSize: 12, lineHeight: 1.5 }}>{preset.tagline}</div>
                </div>
                <div className="row" style={{ width: '100%', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: 'var(--g-prio)' }}>
                  <span>{NICHE_CTA[preset.id]}</span>
                  <ArrowRight size={13} />
                </div>
              </button>
            ))}

            <div className={`niche-card ql-surface ql-regular tf-fade-up tf-stagger-4 ${niche === 'custom' ? 'is-selected' : ''}`}>
              <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                <NicheIcon id="custom" />
                <span className="tf-badge" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }}>Custom</span>
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Custom Niche</div>
                <div className="text-sec" style={{ fontSize: 12, lineHeight: 1.45, marginBottom: 8 }}>
                  Enter any topic niche and build a custom Top 10 bank in {SCRIPT_LANGUAGE_LABELS[language]}.
                </div>
                <input
                  className="tf-input"
                  aria-label="Custom Niche Subject"
                  placeholder="e.g. Philippine Urban Legends"
                  value={customNiche}
                  onChange={(e) => onCustomNicheChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectNiche('custom');
                  }}
                  style={{ width: '100%', marginBottom: 8 }}
                />
              </div>
              <button
                type="button"
                onClick={() => onSelectNiche('custom')}
                className="tf-btn tf-btn-prio ql-press"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>{NICHE_CTA.custom}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'topics' && (
        <>
          <section className="story-card-panel ql-surface ql-regular tf-fade-up">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" onClick={() => onStepChange('welcome')} className="tf-btn ql-surface ql-clear ql-press">
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
                <div>
                  <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
                    Software Topic Bank — {activePreset.title}
                  </h2>
                  <div className="text-sec" style={{ fontSize: 12 }}>
                    Select any #1–#10 topic card below to auto-generate your localized script & SFX cues.
                  </div>
                </div>
              </div>

              <div className="lang-pill-group" role="group" aria-label="Switch Topic Language">
                {(['taglish', 'tagalog', 'english'] as ScriptLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onLanguageChange(lang)}
                    className={`tf-tab ql-press ${language === lang ? 'is-active' : ''}`}
                  >
                    {SCRIPT_LANGUAGE_LABELS[lang]}
                  </button>
                ))}
              </div>
            </div>

            <div className="topic-prompt-bar">
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--g-prio)', marginBottom: 3 }}>
                  Ready AI Topic Bank Prompt ({cliGuide.title})
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{fullTop10Prompt}</div>
                {cliStatusText && (
                  <div className="text-sec" style={{ fontSize: 11, marginTop: 4 }}>{cliStatusText}</div>
                )}
              </div>
              <div className="row">
                <button type="button" onClick={() => onCopy('top10prompt', fullTop10Prompt)} className="tf-btn ql-surface ql-clear ql-press">
                  {copiedKey === 'top10prompt' ? <Check size={13} style={{ color: 'var(--g-prio)' }} /> : <Copy size={13} />}
                  <span>{copiedKey === 'top10prompt' ? 'Copied' : 'Copy Prompt'}</span>
                </button>
                <button type="button" onClick={() => onAskAiTop10(fullTop10Prompt)} className="tf-btn tf-btn-prio ql-press">
                  <Terminal size={13} />
                  <span>Ask AI CLI for Fresh Top 10</span>
                </button>
              </div>
            </div>
          </section>

          <div className="topic-grid">
            {topics.map((topic, idx) => (
              <button
                key={`${topic.rank}-${topic.title}`}
                type="button"
                onClick={() => onSelectTopic(topic)}
                className={`topic-card ql-surface ql-regular tf-fade-up ${idx < 4 ? `tf-stagger-${idx + 1}` : ''} ${
                  selectedTopic?.rank === topic.rank && selectedTopic.title === topic.title ? 'is-selected' : ''
                }`}
              >
                <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span className="tf-badge tabular" style={{ background: 'var(--g-active-bg)', color: 'var(--g-active-fg)' }}>
                    #{String(topic.rank).padStart(2, '0')}
                  </span>
                  <div className="row" style={{ gap: 4 }}>
                    {topic.sfxCues.slice(0, 2).map((cue) => (
                      <span key={cue} className="tf-badge" style={{ background: 'var(--g-sub)', color: 'var(--g-sec)', fontSize: 10 }}>
                        {cue}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{topic.title}</div>
                <div className="text-sec" style={{ fontSize: 12, lineHeight: 1.45 }}>{topic.hook}</div>
                <div className="row" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--g-prio)', marginTop: 2 }}>
                  <span>Draft #{topic.rank} ({SCRIPT_LANGUAGE_LABELS[language]})</span>
                  <ArrowRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'script' && (
        <section className="story-card-panel ql-surface ql-regular tf-scale-in">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" onClick={() => onStepChange('topics')} className="tf-btn ql-surface ql-clear ql-press">
                <ArrowLeft size={13} />
                <span>Topics</span>
              </button>
              <div>
                <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
                  Script Studio — {selectedTopic?.title || 'Custom Short'}
                </h2>
                <div className="text-sec" style={{ fontSize: 12 }}>
                  Edit hook, story beat, and [SFX] markers before exporting clean voiceover text.
                </div>
              </div>
            </div>

            <div className="lang-pill-group" role="group" aria-label="Script Studio Language">
              {(['taglish', 'tagalog', 'english'] as ScriptLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageChange(lang)}
                  className={`tf-tab ql-press ${language === lang ? 'is-active' : ''}`}
                >
                  {SCRIPT_LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          </div>

          <div className="script-studio-grid">
            <div className="col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Screenplay + Auto [SFX] Tags</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {QUICK_SFX_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onScriptChange(`${scriptDraft.trimEnd()}\n${tag}\n`)}
                      className="tf-btn ql-surface ql-clear ql-press"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                aria-label="Generated Script Markdown"
                value={scriptDraft}
                onChange={(e) => onScriptChange(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  padding: 14,
                  background: 'var(--g-sub)',
                  border: '1px solid var(--g-rim)',
                  color: 'inherit',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  resize: 'vertical',
                }}
              />
            </div>

            <div className="story-split-side">
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Character Rig for This Scene</div>
                <div className="ql-tabs" role="group" aria-label="Flow Rig Picker" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => onRigModeChange('chibi')}
                    className={`tf-tab ql-press ${rigMode === 'chibi' ? 'is-active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Chibi Sprites ({rigs?.chibi.sprites ?? 21})
                  </button>
                  <button
                    type="button"
                    onClick={() => onRigModeChange('stickman')}
                    className={`tf-tab ql-press ${rigMode === 'stickman' ? 'is-active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Stickman 3D Rig
                  </button>
                </div>
              </div>

              <div className="text-sec" style={{ fontSize: 12, lineHeight: 1.55 }}>
                <strong>Next Step Preview:</strong> When you save, ToonForge writes real markdown to your project folder and automatically extracts clean ElevenLabs spoken text without `[SFX:]` clutter.
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  disabled={savingScript || !scriptDraft.trim()}
                  onClick={handleSaveNext}
                  className="tf-btn tf-btn-prio ql-press"
                  style={{ width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: 13 }}
                >
                  <span>{savingScript ? 'Saving Script...' : 'Save Script & Go to VO'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 'voiceover' && (
        <section className="story-card-panel ql-surface ql-regular tf-scale-in">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" onClick={() => onStepChange('script')} className="tf-btn ql-surface ql-clear ql-press">
                <ArrowLeft size={13} />
                <span>Edit Script</span>
              </button>
              <div>
                <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
                  ElevenLabs / Voiceover Studio
                </h2>
                <div className="text-sec" style={{ fontSize: 12 }}>
                  Target Slot: <code>{createdCard ? `voice/${createdCard.slug}_voice.wav` : 'voice/short_voice.wav'}</code> · Auto-Q: <strong>{autoQueue ? 'ON' : 'OFF'}</strong>
                </div>
              </div>
            </div>

            <div className="vo-wave" aria-hidden="true" title="Voiceover Waveform Preview">
              {WAVE_DELAYS.map((delay, idx) => (
                <span
                  key={idx}
                  className={`vo-bar ${createdCard?.audioMode === 'no_vo' ? 'is-idle' : ''}`}
                  style={{ animationDelay: delay }}
                />
              ))}
            </div>
          </div>

          <div className="vo-studio-grid">
            <div className="col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  Clean Spoken Narration (SFX tags removed for ElevenLabs)
                </span>
                <button
                  type="button"
                  onClick={() => onCopy('cleanVo', cleanVoNarration)}
                  className="tf-btn ql-surface ql-clear ql-press"
                >
                  {copiedKey === 'cleanVo' ? <Check size={13} style={{ color: 'var(--g-prio)' }} /> : <Copy size={13} />}
                  <span>{copiedKey === 'cleanVo' ? 'Copied Clean VO' : 'Copy Clean Narration'}</span>
                </button>
              </div>

              <div className="vo-clean-box" data-testid="clean-vo-text">
                {cleanVoNarration || 'Write a script in Step 3 to preview clean ElevenLabs speech lines.'}
              </div>

              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span className="text-sec" style={{ fontSize: 12 }}>
                  1. Open ElevenLabs · 2. Paste clean narration · 3. Pick Taglish/Tagalog/EN voice · 4. Export `.wav`/`.mp3`
                </span>
                <a
                  href="https://elevenlabs.io/app/speech-synthesis"
                  target="_blank"
                  rel="noreferrer"
                  className="tf-btn ql-surface ql-clear ql-press"
                  style={{ textDecoration: 'none' }}
                >
                  <span>Open ElevenLabs</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="story-split-side">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Attach Generated Audio or Pick No-VO</div>

              <input
                ref={voInputRef}
                type="file"
                accept=".wav,.mp3"
                aria-label="Upload ElevenLabs Audio File"
                onChange={(e) => handleFileInput(e.target.files)}
                style={{ fontSize: 12 }}
              />

              <button
                type="button"
                disabled={uploadingVo}
                onClick={() => voInputRef.current?.click()}
                className="tf-btn ql-surface ql-clear ql-press"
                style={{ justifyContent: 'center' }}
              >
                <Upload size={14} style={{ color: 'var(--g-prio)' }} />
                <span>{uploadingVo ? 'Uploading Voice File...' : 'Choose .wav or .mp3 Voiceover'}</span>
              </button>

              {voUploadStatus && (
                <div className="tf-badge" style={{ background: 'var(--g-prio-bg)', color: 'var(--g-prio)', padding: '8px 10px' }}>
                  {voUploadStatus}
                </div>
              )}

              {createdCard?.voicePath && (
                <audio controls src={getMediaUrl(createdCard.voicePath)} style={{ width: '100%' }} />
              )}

              <button type="button" onClick={onSkipToNoVo} className="tf-btn ql-surface ql-clear ql-press" style={{ justifyContent: 'center' }}>
                <Mic size={13} />
                <span>Skip VO · Use No-VO Visual Mode</span>
              </button>

              <button
                type="button"
                onClick={onEnterWorkbench}
                className="tf-btn tf-btn-prio ql-press"
                style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: 13 }}
              >
                <span>Open 3D Workbench</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
