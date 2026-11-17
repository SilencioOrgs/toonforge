import { BookOpen, GitBranch, Moon, Sun } from 'lucide-react';
import type { LogoConcept } from '../lib/domain';
import { LogoSvg } from './LogoSvg';

interface TopBarProps {
  theme: 'dark' | 'light';
  activeLogo: LogoConcept;
  syncLabel: string;
  onSelectLogo: (logo: LogoConcept) => void;
  onOpenCompare: () => void;
  onOpenSetup: () => void;
  onSyncRepo: () => void;
  onToggleTheme: () => void;
}

export function TopBar({
  theme,
  activeLogo,
  syncLabel,
  onSelectLogo,
  onOpenCompare,
  onOpenSetup,
  onSyncRepo,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className="tf-topbar ql-surface ql-thin">
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
            onClick={() => onSelectLogo(logo)}
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
          onClick={onOpenCompare}
          className="tf-btn ql-press"
          style={{ color: 'var(--g-sec)', fontWeight: 600 }}
        >
          Compare
        </button>
      </div>

      <div className="tf-top-actions">
        <button type="button" onClick={onOpenSetup} className="ql-surface ql-clear ql-press tf-btn">
          <BookOpen size={14} style={{ color: 'var(--g-prio)' }} />
          <span>Setup Guide</span>
        </button>
        <button type="button" onClick={onSyncRepo} className="ql-surface ql-clear ql-press tf-btn">
          <GitBranch size={14} />
          <span>{syncLabel}</span>
        </button>
        <button type="button" onClick={onToggleTheme} className="ql-surface ql-clear ql-press tf-btn">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  );
}
