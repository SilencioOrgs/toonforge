import { Mic, Plus, VolumeX } from 'lucide-react';
import type { BoardState, LaneId } from '../lib/domain';
import { PIPELINE, nextStep, stepDone } from '../lib/pipeline';
import { EmptyState, PageHeader } from './ui';

const LANES: { id: LaneId; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'queued', label: 'Queued' },
  { id: 'done', label: 'Done' },
];
const AUDIO_LABEL = { needs_vo: 'Needs voice', vo_ready: 'Voice ready', no_vo: 'Music only' } as const;

export function LibraryPage({
  board,
  loading,
  currentId,
  onSelectLane,
  onOpenCard,
  onToggleAudio,
  onToggleAutoQueue,
  onNewShort,
}: {
  board: BoardState;
  loading: boolean;
  currentId?: string;
  onSelectLane: (lane: LaneId) => void;
  onOpenCard: (cardId: string) => void;
  onToggleAudio: (cardId: string) => void;
  onToggleAutoQueue: () => void;
  onNewShort: () => void;
}) {
  const visible = board.cards.filter((c) => c.lane === board.activeLane);
  return (
    <article className="page page-wide">
      <PageHeader
        title="All shorts"
        lead="Every short in this workspace. Open one to continue at its next unfinished step."
        actions={
          <button type="button" className="btn btn-primary" onClick={onNewShort}>
            <Plus size={14} />
            <span>New short</span>
          </button>
        }
      />

      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Lane">
          {LANES.map((l) => (
            <button key={l.id} type="button" role="tab" aria-selected={board.activeLane === l.id} className={board.activeLane === l.id ? 'is-active' : ''} onClick={() => onSelectLane(l.id)}>
              {l.label} <span className="tabular muted">{board.cards.filter((c) => c.lane === l.id).length}</span>
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={board.autoQueue} onChange={onToggleAutoQueue} />
          <span>Auto-queue shorts once their voice is ready</span>
        </label>
      </div>

      {loading ? (
        <p className="muted">Reading the workspace...</p>
      ) : visible.length === 0 ? (
        <EmptyState title={`Nothing in ${board.activeLane}`}>Shorts move to Queued when their voice is ready and Auto-queue is on.</EmptyState>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Short</th>
              <th>Voice</th>
              <th>Progress</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((card) => {
              const done = PIPELINE.filter((s) => stepDone(card, s.id)).length;
              const next = PIPELINE.find((s) => s.id === nextStep(card))!;
              return (
                <tr key={card.id} className={card.id === currentId ? 'is-current' : undefined}>
                  <td>
                    <button type="button" className="link-btn strong" onClick={() => onOpenCard(card.id)}>
                      {card.title}
                    </button>
                    <div className="muted small">{card.rigMode === 'stickman' ? 'Stickman' : 'Chibi'} · {card.scriptFile ?? 'no script yet'}</div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`chip ${card.audioMode === 'vo_ready' ? 'is-ok' : ''}`}
                      onClick={() => onToggleAudio(card.id)}
                      title="Click to change: needs voice, voice ready, music only"
                    >
                      {card.audioMode === 'no_vo' ? <VolumeX size={13} /> : <Mic size={13} />}
                      {AUDIO_LABEL[card.audioMode]}
                    </button>
                  </td>
                  <td className="tabular">
                    <span className="meter" aria-hidden="true">
                      <span style={{ width: `${(done / PIPELINE.length) * 100}%` }} />
                    </span>{' '}
                    {done}/{PIPELINE.length}
                  </td>
                  <td>{done === PIPELINE.length ? <span className="ok">Finished</span> : next.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </article>
  );
}
