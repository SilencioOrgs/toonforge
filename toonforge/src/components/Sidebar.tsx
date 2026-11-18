import {
  AudioLines,
  BookOpen,
  Boxes,
  Camera,
  Check,
  Clapperboard,
  FileText,
  GitBranch,
  Info,
  Library,
  Lightbulb,
  Mic,
  Moon,
  Plus,
  Sun,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { CardItem } from '../lib/domain';
import { PIPELINE, stepDone, type PageId, type StepId } from '../lib/pipeline';
import { LogoSvg } from './LogoSvg';

const STEP_ICONS: Record<StepId, LucideIcon> = {
  topic: Lightbulb,
  script: FileText,
  voice: Mic,
  scenes: Boxes,
  sound: AudioLines,
  look: Camera,
  render: Clapperboard,
};

interface SidebarProps {
  page: PageId;
  cards: CardItem[];
  currentCard?: CardItem;
  draftTitle: string | null;
  reqReady: number;
  reqTotal: number;
  branch?: string;
  syncState: 'idle' | 'busy' | 'ok' | 'error';
  theme: 'dark' | 'light';
  dockOpen: boolean;
  onNavigate: (page: PageId) => void;
  onSelectCard: (cardId: string) => void;
  onNewShort: () => void;
  onSync: () => void;
  onToggleTheme: () => void;
  onToggleDock: () => void;
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button type="button" className={`nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon size={16} />
      <span className="nav-label">{label}</span>
      {trailing}
    </button>
  );
}

const SYNC_LABEL = { idle: 'Sync', busy: 'Syncing', ok: 'Synced', error: 'Sync failed' } as const;

export function Sidebar({
  page,
  cards,
  currentCard,
  draftTitle,
  reqReady,
  reqTotal,
  branch,
  syncState,
  theme,
  dockOpen,
  onNavigate,
  onSelectCard,
  onNewShort,
  onSync,
  onToggleTheme,
  onToggleDock,
}: SidebarProps) {
  const reqOk = reqTotal > 0 && reqReady === reqTotal;

  return (
    <nav className="side ql-surface ql-thin" aria-label="Main">
      <div className="brand">
        <span className="brand-mark">
          <LogoSvg concept="cube" />
        </span>
        <div>
          <div className="brand-name">ToonForge</div>
          <div className="brand-sub">for claude-animated-shorts</div>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-heading">Guide</div>
        <NavItem icon={Info} label="Introduction" active={page === 'intro'} onClick={() => onNavigate('intro')} />
        <NavItem icon={BookOpen} label="How to use" active={page === 'howto'} onClick={() => onNavigate('howto')} />
        <NavItem
          icon={Wrench}
          label="Requirements"
          active={page === 'requirements'}
          onClick={() => onNavigate('requirements')}
          trailing={
            reqTotal > 0 && (
              <span className={`count ${reqOk ? 'is-ok' : 'is-warn'}`} title={`${reqReady} of ${reqTotal} installed`}>
                {reqReady}/{reqTotal}
              </span>
            )
          }
        />
      </div>

      <div className="nav-group">
        <div className="nav-heading">Short</div>
        <div className="short-picker">
          <select
            aria-label="Current short"
            value={draftTitle !== null ? '__draft' : currentCard?.id ?? ''}
            onChange={(e) => onSelectCard(e.target.value)}
          >
            {draftTitle !== null && <option value="__draft">{draftTitle || 'New short (unsaved)'}</option>}
            {cards.length === 0 && draftTitle === null && <option value="">No shorts yet</option>}
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" onClick={onNewShort} aria-label="New short" title="New short">
            <Plus size={16} />
          </button>
        </div>
        <ol className="steps">
          {PIPELINE.map((s) => {
            const done = draftTitle === null && stepDone(currentCard, s.id);
            return (
              <li key={s.id}>
                <NavItem
                  icon={STEP_ICONS[s.id]}
                  label={s.label}
                  active={page === s.id}
                  onClick={() => onNavigate(s.id)}
                  trailing={done ? <Check size={14} className="ok" aria-label="done" /> : null}
                />
              </li>
            );
          })}
        </ol>
        <NavItem icon={Library} label="All shorts" active={page === 'library'} onClick={() => onNavigate('library')} trailing={<span className="count">{cards.length}</span>} />
      </div>

      <div className="side-foot">
        <button type="button" className={`nav-item ${dockOpen ? 'is-on' : ''}`} aria-pressed={dockOpen} onClick={onToggleDock}>
          <Terminal size={16} />
          <span className="nav-label">Agent terminal</span>
        </button>
        <div className="foot-row">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onSync} disabled={syncState === 'busy'} title="Pull the latest workspace changes with git">
            <GitBranch size={14} />
            <span>{branch ?? 'main'}</span>
            <span className={syncState === 'error' ? 'err' : 'muted'}>· {SYNC_LABEL[syncState]}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
