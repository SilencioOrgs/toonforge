import { useEffect, useState } from 'react';
import { Camera, FileText, Film, ImagePlus, Play, Save, Sparkles, User } from 'lucide-react';
import { errorMessage, type CardItem, type RigMode, type RigSummary, type ScriptDoc } from '../lib/domain';
import { StageSvg } from './StageSvg';

export type StageTab = 'rig' | 'video' | 'stills' | 'script';

interface StageInspectorPaneProps {
  selectedCard?: CardItem;
  rigs: RigSummary | null;
  branch?: string;
  stageView: StageTab;
  getMediaUrl: (relPath: string) => string;
  onLoadScript: (slug: string) => Promise<ScriptDoc>;
  onSaveScript: (slug: string, content: string) => Promise<ScriptDoc>;
  onChangeStageView: (view: StageTab) => void;
  onChangeRig: (rig: RigMode) => void;
  onCheckStills: () => void;
  onRunQa: () => void;
  onAppendLog: (line: string) => void;
}

export function StageInspectorPane({
  selectedCard,
  rigs,
  branch,
  stageView,
  getMediaUrl,
  onLoadScript,
  onSaveScript,
  onChangeStageView,
  onChangeRig,
  onCheckStills,
  onRunQa,
  onAppendLog,
}: StageInspectorPaneProps) {
  const spriteFiles = rigs?.chibi.spriteFiles ?? [];
  const faceFiles = rigs?.chibi.faceFiles ?? [];
  const fxFiles = rigs?.chibi.fxFiles ?? [];

  const [selectedSprite, setSelectedSprite] = useState('idle.png');
  const [selectedFace, setSelectedFace] = useState('happy.png');
  const [selectedFx, setSelectedFx] = useState('sparkle.png');
  const [scriptText, setScriptText] = useState('');
  const [scriptFileName, setScriptFileName] = useState('');
  const [scriptStatus, setScriptStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (spriteFiles.length > 0 && !spriteFiles.includes(selectedSprite)) {
      setSelectedSprite(spriteFiles.includes('idle.png') ? 'idle.png' : spriteFiles[0]);
    }
    if (faceFiles.length > 0 && !faceFiles.includes(selectedFace)) {
      setSelectedFace(faceFiles[0]);
    }
    if (fxFiles.length > 0 && !fxFiles.includes(selectedFx)) {
      setSelectedFx(fxFiles[0]);
    }
  }, [spriteFiles, faceFiles, fxFiles, selectedSprite, selectedFace, selectedFx]);

  useEffect(() => {
    if (!selectedCard || stageView !== 'script') return;
    let active = true;
    onLoadScript(selectedCard.slug)
      .then((doc) => {
        if (!active) return;
        setScriptFileName(doc.file);
        setScriptText(doc.content);
        setScriptStatus('idle');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setScriptStatus('error');
        onAppendLog(`script error > ${errorMessage(err)}`);
      });
    return () => {
      active = false;
    };
  }, [selectedCard?.slug, stageView, onLoadScript, onAppendLog]);

  const handleSaveScript = async () => {
    if (!selectedCard) return;
    setScriptStatus('saving');
    try {
      const saved = await onSaveScript(selectedCard.slug, scriptText);
      setScriptFileName(saved.file);
      setScriptStatus('saved');
      onAppendLog(`script > saved ${saved.file} (${saved.content.length} chars)`);
    } catch (err: unknown) {
      setScriptStatus('error');
      onAppendLog(`script save failed > ${errorMessage(err)}`);
    }
  };

  const audioFile = selectedCard?.mixWavFile || selectedCard?.voicePath;

  return (
    <section className="tf-col-stage tf-pane ql-surface ql-regular">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="font-display" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
          Stage Preview
        </h2>
        <span className="text-sec tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {selectedCard?.specs ? selectedCard.specs.split(',')[0] : '1440×2560'}
        </span>
      </div>

      <div className="tf-tab-strip">
        {(
          [
            { id: 'rig', label: 'Rig', Icon: Sparkles },
            { id: 'video', label: 'Video', Icon: Film },
            { id: 'stills', label: 'Stills', Icon: Camera },
            { id: 'script', label: 'Script', Icon: FileText },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeStageView(id)}
            className={`tf-tab ql-press ${stageView === id ? 'is-active' : ''}`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="tf-tab-strip" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => onChangeRig('stickman')}
          className={`tf-tab ql-press ${selectedCard?.rigMode === 'stickman' ? 'is-active' : ''}`}
        >
          <User size={13} />
          <span>Stickman</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeRig('chibi')}
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

        {stageView === 'rig' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StageSvg rigMode={selectedCard?.rigMode ?? 'chibi'} slug={selectedCard?.slug} />
            {selectedCard?.rigMode !== 'stickman' && spriteFiles.length > 0 && (
              <div className="chibi-strip">
                <div className="chibi-slot">
                  <img
                    src={getMediaUrl(`src/videos/chibi/sprites/${selectedSprite}`)}
                    alt={selectedSprite}
                    className="chibi-preview-img"
                  />
                  <select
                    aria-label="Sprite pose"
                    value={selectedSprite}
                    onChange={(e) => setSelectedSprite(e.target.value)}
                    className="chibi-select"
                  >
                    {spriteFiles.map((f) => (
                      <option key={f} value={f}>{f.replace('.png', '')}</option>
                    ))}
                  </select>
                </div>
                {faceFiles.length > 0 && (
                  <div className="chibi-slot">
                    <img
                      src={getMediaUrl(`src/videos/chibi/faces/${selectedFace}`)}
                      alt={selectedFace}
                      className="chibi-preview-img"
                    />
                    <select
                      aria-label="Face expression"
                      value={selectedFace}
                      onChange={(e) => setSelectedFace(e.target.value)}
                      className="chibi-select"
                    >
                      {faceFiles.map((f) => (
                        <option key={f} value={f}>{f.replace('.png', '')}</option>
                      ))}
                    </select>
                  </div>
                )}
                {fxFiles.length > 0 && (
                  <div className="chibi-slot">
                    <img
                      src={getMediaUrl(`src/videos/chibi/fx/${selectedFx}`)}
                      alt={selectedFx}
                      className="chibi-preview-img"
                    />
                    <select
                      aria-label="FX overlay"
                      value={selectedFx}
                      onChange={(e) => setSelectedFx(e.target.value)}
                      className="chibi-select"
                    >
                      {fxFiles.map((f) => (
                        <option key={f} value={f}>{f.replace('.png', '')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {stageView === 'video' &&
          (selectedCard?.videoFile ? (
            <video controls playsInline src={getMediaUrl(selectedCard.videoFile)} className="stage-video" />
          ) : (
            <div style={{ fontSize: 12, color: '#d4d4d8', textAlign: 'center', padding: '24px 8px' }}>
              No rendered MP4 yet for {selectedCard?.slug ?? 'this card'}.
            </div>
          ))}

        {stageView === 'stills' &&
          (selectedCard?.stills && selectedCard.stills.length > 0 ? (
            <div className="stills-grid">
              {selectedCard.stills.map((imgPath) => (
                <img key={imgPath} src={getMediaUrl(imgPath)} alt={imgPath} className="still-thumb" />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#d4d4d8', textAlign: 'center', padding: '24px 8px' }}>
              No stills found in out/{selectedCard?.slug ?? ''}/stills yet.
            </div>
          ))}

        {stageView === 'script' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#d4d4d8' }}>
              <span>{scriptFileName || selectedCard?.scriptFile || 'SCRIPT.md'}</span>
              <button type="button" onClick={handleSaveScript} className="pill-prio ql-press" style={{ padding: '4px 10px' }}>
                <Save size={12} />
                <span>
                  {scriptStatus === 'saving'
                    ? 'Saving...'
                    : scriptStatus === 'saved'
                      ? 'Saved'
                      : scriptStatus === 'error'
                        ? 'Retry Save'
                        : 'Save'}
                </span>
              </button>
            </div>
            <textarea
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                if (scriptStatus !== 'idle') setScriptStatus('idle');
              }}
              rows={4}
              className="script-editor"
              placeholder="Write your hook, story beats, and CTA..."
            />
            {audioFile && (
              <audio controls src={getMediaUrl(audioFile)} style={{ width: '100%', height: 28 }} />
            )}
          </div>
        )}

        <div className="stage-actions">
          <button type="button" onClick={onCheckStills} className="pill-light ql-press">
            <Camera size={13} />
            <span>Check Stills</span>
          </button>
          <button type="button" onClick={onRunQa} className="pill-prio ql-press">
            <Play size={13} />
            <span>Run QA</span>
          </button>
        </div>
      </div>

      <div className="text-sec tabular" style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span>{rigs ? `Chibi: ${rigs.chibi.sprites} sprites · ${rigs.chibi.faces} faces` : 'Inspecting rigs...'}</span>
        <span>{branch ? `git:${branch}` : 'git:main'}</span>
      </div>
    </section>
  );
}
