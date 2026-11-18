import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Camera, ExternalLink, ImagePlus, LoaderCircle, Play, Save, Upload, User, VolumeX } from 'lucide-react';
import {
  NICHE_PRESETS,
  SCRIPT_LANGUAGE_LABELS,
  type CardItem,
  type ContentNicheId,
  type RigMode,
  type RigSummary,
  type ScriptLanguage,
  type TopicIdea,
} from '../lib/domain';
import { estimateSeconds, PIPELINE, stepDone, stepPrompt, type PageId, type StepId } from '../lib/pipeline';
import { StageSvg } from './StageSvg';
import { CommandBlock, CopyButton, EmptyState, PageHeader } from './ui';

type Nav = (page: PageId) => void;
type Send = (text: string) => void;

const LANGS: ScriptLanguage[] = ['english', 'taglish', 'tagalog'];
const SFX_TAGS = ['[SFX: WHOOSH_IN]', '[SFX: SUB_DROP]', '[SFX: CAMERA_FLASH]', '[SFX: HEARTBEAT_SLOW]'];

function stepMeta(id: StepId) {
  return PIPELINE.find((s) => s.id === id)!;
}

function StepHeader({ id, card, actions }: { id: StepId; card?: CardItem; actions?: ReactNode }) {
  const meta = stepMeta(id);
  const n = PIPELINE.indexOf(meta) + 1;
  return (
    <PageHeader
      title={`${n}. ${meta.label}`}
      lead={
        <>
          {meta.summary}{meta.output && <span className="out-hint"> Produces <code>{id === 'script' && card?.scriptFile ? card.scriptFile : card ? meta.output.replace(/<name>/gi, card.slug) : meta.output}</code></span>}
        </>
      }
      actions={actions}
    />
  );
}

function NextButton({ from, onNavigate }: { from: StepId; onNavigate: Nav }) {
  const i = PIPELINE.findIndex((s) => s.id === from);
  const next = PIPELINE[i + 1];
  if (!next) return null;
  return (
    <div className="next-row">
      <button type="button" className="btn btn-quiet" onClick={() => onNavigate(next.id)}>
        <span>Next: {next.label}</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

function NeedsCard({ onNavigate }: { onNavigate: Nav }) {
  return (
    <EmptyState
      title="No saved short selected"
      action={
        <button type="button" className="btn btn-primary" onClick={() => onNavigate('topic')}>
          <span>Pick a topic</span>
          <ArrowRight size={14} />
        </button>
      }
    >
      This step works on a saved short. Start from a topic, or choose an existing short in the sidebar.
    </EmptyState>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* 1. Topic */
export function TopicPage({
  language,
  niche,
  customNiche,
  topics,
  onLanguageChange,
  onNicheChange,
  onCustomNicheChange,
  onSelectTopic,
  onSend,
}: {
  language: ScriptLanguage;
  niche: ContentNicheId;
  customNiche: string;
  topics: TopicIdea[];
  onLanguageChange: (l: ScriptLanguage) => void;
  onNicheChange: (n: ContentNicheId) => void;
  onCustomNicheChange: (v: string) => void;
  onSelectTopic: (t: TopicIdea) => void;
  onSend: Send;
}) {
  const preset = NICHE_PRESETS.find((p) => p.id === niche) ?? NICHE_PRESETS[0];
  const subject = niche === 'custom' ? customNiche.trim() || 'a subject of your choice' : preset.title.toLowerCase();
  const askPrompt = `Use the cartoon short skill, step 1. Suggest 10 surprising true stories about ${subject} that have a clear physical cause and effect and a simple everyday analogy. Write in ${SCRIPT_LANGUAGE_LABELS[language]}. One line each: title, the visual moment, the analogy.`;

  return (
    <article className="page page-wide">
      <StepHeader id="topic" />

      <div className="toolbar">
        <Seg label="Topic bank" value={niche} options={NICHE_PRESETS.map((p) => ({ id: p.id, label: p.id === 'custom' ? 'Your own' : p.title }))} onChange={onNicheChange} />
        <Seg label="Script language" value={language} options={LANGS.map((l) => ({ id: l, label: SCRIPT_LANGUAGE_LABELS[l] }))} onChange={onLanguageChange} />
      </div>

      {niche === 'custom' && (
        <label className="field">
          <span>Your subject</span>
          <input className="input" placeholder="e.g. famous engineering failures" value={customNiche} onChange={(e) => onCustomNicheChange(e.target.value)} />
        </label>
      )}

      <p className="muted">{preset.tagline} Picking a topic starts a new short with a draft script.</p>

      <ol className="topic-list">
        {topics.map((t) => (
          <li key={`${t.rank}-${t.title}`}>
            <button type="button" className="topic-row" onClick={() => onSelectTopic(t)}>
              <span className="topic-rank tabular">{t.rank}</span>
              <span className="grow">
                <span className="topic-title">{t.title}</span>
                <span className="muted topic-hook">{t.hook}</span>
              </span>
              <span className="topic-go">
                Use <ArrowRight size={14} />
              </span>
            </button>
          </li>
        ))}
      </ol>

      <section className="section">
        <h2 className="section-title">Want fresh ideas?</h2>
        <p className="muted">Ask your agent for stories that fit the skill's formula.</p>
        <CommandBlock text={askPrompt} onSend={onSend} />
      </section>
    </article>
  );
}

/* 2. Script */
export function ScriptPage({
  card,
  isDraft,
  title,
  text,
  loading,
  saveState,
  language,
  canRelocalize,
  onTitleChange,
  onTextChange,
  onLanguageChange,
  onSave,
  onSend,
  onNavigate,
}: {
  card?: CardItem;
  isDraft: boolean;
  title: string;
  text: string;
  loading: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  language: ScriptLanguage;
  canRelocalize: boolean;
  onTitleChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onLanguageChange: (l: ScriptLanguage) => void;
  onSave: () => void;
  onSend: Send;
  onNavigate: Nav;
}) {
  if (!isDraft && !card) {
    return (
      <article className="page">
        <StepHeader id="script" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  const secs = estimateSeconds(text);
  const lengthState = secs < 55 ? 'short' : secs > 70 ? 'long' : 'ok';

  return (
    <article className="page page-wide">
      <StepHeader
        id="script"
        card={card}
        actions={
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saveState === 'saving' || !text.trim() || (isDraft && !title.trim())}>
            {saveState === 'saving' ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
            <span>{isDraft ? 'Save short' : saveState === 'saved' ? 'Saved' : 'Save script'}</span>
          </button>
        }
      />
      {saveState === 'error' && <p className="err-text">The script could not be saved. Check the agent terminal log for the reason, then try again.</p>}

      <div className="split">
        <div className="col">
          {isDraft && (
            <label className="field">
              <span>Title</span>
              <input className="input" value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="The Bridge That Fell for a Song" />
            </label>
          )}
          <div className="field">
            <span>Script</span>
            <textarea
              aria-label="Script"
              className="editor"
              value={loading ? '' : text}
              placeholder={loading ? 'Loading script...' : 'Hook, story beats, and the closing line. Put [SFX: NAME] cues on their own lines.'}
              onChange={(e) => onTextChange(e.target.value)}
              rows={18}
              disabled={loading}
            />
          </div>
          <div className="row wrap">
            <span className="muted small">Insert cue:</span>
            {SFX_TAGS.map((tag) => (
              <button key={tag} type="button" className="chip" onClick={() => onTextChange(`${text.trimEnd()}\n${tag}\n`)}>
                {tag.slice(6, -1)}
              </button>
            ))}
          </div>
        </div>

        <aside className="aside">
          <div className="stat">
            <span className="muted small">Estimated length</span>
            <span className={`stat-value tabular ${lengthState === 'ok' ? 'ok' : 'warn'}`}>{secs} s</span>
            <span className="muted small">
              {lengthState === 'ok' ? 'Inside the 55 to 70 s target.' : lengthState === 'short' ? 'Under the 55 s target. Add a beat.' : 'Over 70 s. Cut a beat.'}
            </span>
          </div>
          {isDraft && canRelocalize && (
            <div className="field">
              <span>Draft language</span>
              <Seg label="Draft language" value={language} options={LANGS.map((l) => ({ id: l, label: SCRIPT_LANGUAGE_LABELS[l] }))} onChange={onLanguageChange} />
              <span className="muted small">Switching rewrites the draft from the topic.</span>
            </div>
          )}
          {card && (
            <div className="field">
              <span>Polish with your agent</span>
              <CommandBlock text={stepPrompt('script', card)} onSend={onSend} />
            </div>
          )}
          {isDraft && <p className="muted small">Saving creates the short's script file in your workspace and opens the Voice step.</p>}
        </aside>
      </div>
      {card && <NextButton from="script" onNavigate={onNavigate} />}
    </article>
  );
}

/* 3. Voice */
export function VoicePage({
  card,
  narration,
  uploadStatus,
  getMediaUrl,
  onUpload,
  onNoVoice,
  onSend,
  onNavigate,
}: {
  card?: CardItem;
  narration: string;
  uploadStatus: { kind: 'ok' | 'error'; text: string } | null;
  getMediaUrl: (p: string) => string;
  onUpload: (file: File) => Promise<void>;
  onNoVoice: () => void;
  onSend: Send;
  onNavigate: Nav;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (!card) {
    return (
      <article className="page">
        <StepHeader id="voice" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  const noVo = card.audioMode === 'no_vo';

  return (
    <article className="page page-wide">
      <StepHeader id="voice" card={card} />
      <div className="split">
        <div className="col">
          <div className="row between">
            <h2 className="section-title">Narration to record</h2>
            <CopyButton text={narration} label="Copy narration" />
          </div>
          <p className="muted small">Your script with headings and [SFX] cues removed, ready to read aloud or paste into a text-to-speech tool.</p>
          <div className="narration" data-testid="clean-vo-text">
            {narration || 'Your script is empty. Write it in the Script step first.'}
          </div>
          <a className="btn btn-quiet self-start" href="https://elevenlabs.io/app/speech-synthesis" target="_blank" rel="noreferrer">
            <span>Open ElevenLabs text to speech</span>
            <ExternalLink size={14} />
          </a>
        </div>

        <aside className="aside">
          <div className="field">
            <span>Voice file</span>
            {card.voicePath ? (
              <>
                <div className="ok small">Attached: {card.voicePath}</div>
                <audio controls src={getMediaUrl(card.voicePath)} />
              </>
            ) : noVo ? (
              <div className="small">Music-only short. No voice needed.</div>
            ) : (
              <div className="muted small">None yet. Upload a .wav or .mp3.</div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".wav,.mp3"
            aria-label="Voice file"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                await onUpload(f);
              } finally {
                setUploading(false);
                e.target.value = '';
              }
            }}
          />
          <button type="button" className="btn btn-primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
            <span>{uploading ? 'Uploading' : card.voicePath ? 'Replace voice file' : 'Upload voice file'}</span>
          </button>
          {uploadStatus && <p className={uploadStatus.kind === 'ok' ? 'ok small' : 'err-text'}>{uploadStatus.text}</p>}
          {!noVo && (
            <button type="button" className="btn btn-quiet" onClick={onNoVoice}>
              <VolumeX size={14} />
              <span>Skip voice, make it music-only</span>
            </button>
          )}
          {card.voicePath && (
            <div className="field">
              <span>Word timings</span>
              <span className="muted small">The shot plan is timed to words.json. Ask your agent to make it from the voice file.</span>
              <CommandBlock text={stepPrompt('words', card)} onSend={onSend} />
            </div>
          )}
        </aside>
      </div>
      <NextButton from="voice" onNavigate={onNavigate} />
    </article>
  );
}

/* 4. Scenes */
export function ScenesPage({
  card,
  rigs,
  busy,
  getMediaUrl,
  onRigChange,
  onTypecheck,
  onSend,
  onNavigate,
}: {
  card?: CardItem;
  rigs: RigSummary | null;
  busy: boolean;
  getMediaUrl: (p: string) => string;
  onRigChange: (r: RigMode) => void;
  onTypecheck: () => void;
  onSend: Send;
  onNavigate: Nav;
}) {
  if (!card) {
    return (
      <article className="page">
        <StepHeader id="scenes" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  const sprites = rigs?.chibi.spriteFiles?.slice(0, 6) ?? [];
  return (
    <article className="page page-wide">
      <StepHeader id="scenes" card={card} />
      <div className="split">
        <div className="col">
          <h2 className="section-title">What your agent builds</h2>
          <dl className="defs">
            <dt>Shot plan</dt>
            <dd>Copies the bridge template to src/videos/{card.slug}/ and times every shot in story.ts.</dd>
            <dt>World</dt>
            <dd>The painted 3D set the story happens in.</dd>
            <dt>Characters</dt>
            <dd>2D characters placed and animated in that world.</dd>
            <dt>Post</dt>
            <dd>Ink outlines, lens blur and the color grade that give the skill its look.</dd>
          </dl>
          <CommandBlock text={stepPrompt('scenes', card)} onSend={onSend} />
          <div className="row">
            <button type="button" className="btn btn-quiet" onClick={onTypecheck} disabled={busy}>
              {busy && <LoaderCircle size={14} className="spin" />}
              <span>Check the code compiles</span>
            </button>
          </div>
        </div>

        <aside className="aside">
          <div className="field">
            <span>Characters</span>
            <Seg
              label="Character rig"
              value={card.rigMode}
              options={[
                { id: 'chibi', label: 'Chibi sprites' },
                { id: 'stickman', label: 'Stickman' },
              ]}
              onChange={onRigChange}
            />
          </div>
          <div className="stage">
            <StageSvg rigMode={card.rigMode} slug={card.slug} />
          </div>
          {card.rigMode === 'chibi' ? (
            sprites.length > 0 ? (
              <>
                <div className="sprites">
                  {sprites.map((f) => (
                    <img key={f} src={getMediaUrl(`src/videos/chibi/sprites/${f}`)} alt={f.replace('.png', '')} title={f.replace('.png', '')} />
                  ))}
                </div>
                <p className="muted small">
                  <ImagePlus size={13} /> {rigs?.chibi.sprites} sprites, {rigs?.chibi.faces} faces, {rigs?.chibi.fx} effects in src/videos/chibi/
                </p>
              </>
            ) : (
              <p className="muted small">No sprites found in src/videos/chibi/sprites/. Add PNG sprites there, or use Stickman.</p>
            )
          ) : (
            <p className="muted small">
              <User size={13} /> Built in, no image files needed.
            </p>
          )}
        </aside>
      </div>
      <NextButton from="scenes" onNavigate={onNavigate} />
    </article>
  );
}

/* 5. Sound */
export function SoundPage({ card, getMediaUrl, onSend, onNavigate }: { card?: CardItem; getMediaUrl: (p: string) => string; onSend: Send; onNavigate: Nav }) {
  if (!card) {
    return (
      <article className="page">
        <StepHeader id="sound" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  return (
    <article className="page">
      <StepHeader id="sound" card={card} />
      <section className="section">
        <h2 className="section-title">Current mix</h2>
        {card.mixWavFile ? (
          <>
            <p className="small">
              {card.mixWavFile}
              {card.loudness && <span className="muted tabular"> · {card.loudness}</span>}
            </p>
            <audio controls src={getMediaUrl(card.mixWavFile)} />
          </>
        ) : (
          <p className="muted">No mix yet. Your agent builds it from the shot plan, so finish Scenes first.</p>
        )}
      </section>
      <section className="section">
        <h2 className="section-title">Ask your agent</h2>
        <CommandBlock text={stepPrompt('sound', card)} onSend={onSend} />
      </section>
      <NextButton from="sound" onNavigate={onNavigate} />
    </article>
  );
}

/* 6. Look check */
export function LookPage({
  card,
  busy,
  getMediaUrl,
  onRunStills,
  onSend,
  onNavigate,
}: {
  card?: CardItem;
  busy: boolean;
  getMediaUrl: (p: string) => string;
  onRunStills: () => void;
  onSend: Send;
  onNavigate: Nav;
}) {
  if (!card) {
    return (
      <article className="page">
        <StepHeader id="look" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  const stills = card.stills ?? [];
  return (
    <article className="page page-wide">
      <StepHeader
        id="look"
        card={card}
        actions={
          <button type="button" className="btn btn-primary" onClick={onRunStills} disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <Camera size={14} />}
            <span>{busy ? 'Making stills' : 'Make stills'}</span>
          </button>
        }
      />
      {stills.length > 0 ? (
        <div className="stills">
          {stills.map((p) => (
            <a key={p} href={getMediaUrl(p)} target="_blank" rel="noreferrer">
              <img src={getMediaUrl(p)} alt={p.split('/').pop()} />
            </a>
          ))}
        </div>
      ) : (
        <EmptyState title="No stills yet">Make stills to see key frames from the scene before you commit to a full render.</EmptyState>
      )}
      <section className="section">
        <h2 className="section-title">What to look for</h2>
        <ul className="plain-list">
          <li>Can a viewer tell what each prop is at phone size?</li>
          <li>Do the characters stand out from the background?</li>
          <li>Is anything important cut off by captions or the frame edge?</li>
        </ul>
        <CommandBlock text={stepPrompt('look', card)} onSend={onSend} sendLabel="Have the agent review" />
      </section>
      <NextButton from="look" onNavigate={onNavigate} />
    </article>
  );
}

/* 7. Render & QA */
export function RenderPage({
  card,
  busy,
  getMediaUrl,
  onRender,
  onSend,
  onNavigate,
}: {
  card?: CardItem;
  busy: boolean;
  getMediaUrl: (p: string) => string;
  onRender: () => void;
  onSend: Send;
  onNavigate: Nav;
}) {
  if (!card) {
    return (
      <article className="page">
        <StepHeader id="render" />
        <NeedsCard onNavigate={onNavigate} />
      </article>
    );
  }
  const qaPass = stepDone(card, 'render');
  return (
    <article className="page page-wide">
      <StepHeader
        id="render"
        card={card}
        actions={
          <button type="button" className="btn btn-primary" onClick={onRender} disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}
            <span>{busy ? 'Rendering' : card.videoFile ? 'Render again' : 'Render and check'}</span>
          </button>
        }
      />
      {busy && <p className="muted">Rendering runs on your PC and can take several minutes. Output appears in the agent terminal log.</p>}
      <div className="split">
        <div className="col">
          {card.videoFile ? (
            <video className="player" controls playsInline src={getMediaUrl(card.videoFile)} />
          ) : (
            <EmptyState title="Not rendered yet">The finished 1440 x 2560 MP4 will play here.</EmptyState>
          )}
        </div>
        <aside className="aside">
          <dl className="facts">
            <dt>Video</dt>
            <dd>{card.videoFile ?? 'Not rendered'}</dd>
            <dt>QA</dt>
            <dd className={qaPass ? 'ok' : card.videoFile ? 'warn' : undefined}>{card.qaReport ? 'Report written' : card.videoFile ? 'Not checked yet' : 'Waiting for render'}</dd>
            {card.loudness && (
              <>
                <dt>Loudness</dt>
                <dd className="tabular">{card.loudness}</dd>
              </>
            )}
            {card.specs && (
              <>
                <dt>Format</dt>
                <dd className="tabular">{card.specs}</dd>
              </>
            )}
          </dl>
          <div className="field">
            <span>Or let your agent run it</span>
            <CommandBlock text={stepPrompt('render', card)} onSend={onSend} />
          </div>
        </aside>
      </div>
    </article>
  );
}
