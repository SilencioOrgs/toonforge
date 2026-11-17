import type { RefObject } from 'react';
import type { LogoConcept } from '../lib/domain';
import { LogoSvg } from './LogoSvg';

interface IconPickerDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  activeLogo: LogoConcept;
  onSelectLogo: (logo: LogoConcept) => void;
}

export function IconPickerDialog({ dialogRef, activeLogo, onSelectLogo }: IconPickerDialogProps) {
  return (
    <dialog ref={dialogRef} className="tf-dialog">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Choose ToonForge App Icon
        </h3>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
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
            onClick={() => onSelectLogo(item.id)}
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
              <span className="font-display" style={{ fontSize: 12, fontWeight: 700 }}>
                ToonForge
              </span>
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
  );
}
