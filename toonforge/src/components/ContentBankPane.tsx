import { Layers, Mic, Plus, Sparkles, VolumeX } from 'lucide-react';
import type { BoardState, CardItem, LaneId } from '../lib/domain';

interface ContentBankPaneProps {
  board: BoardState;
  loading: boolean;
  selectedCard?: CardItem;
  newCardTitle: string;
  onNewCardTitleChange: (title: string) => void;
  onCreateCard: () => void;
  onToggleAutoQueue: () => void;
  onSelectLane: (lane: LaneId) => void;
  onSelectCard: (cardId: string) => void;
  onToggleCardMode: (cardId: string) => void;
}

export function ContentBankPane({
  board,
  loading,
  selectedCard,
  newCardTitle,
  onNewCardTitleChange,
  onCreateCard,
  onToggleAutoQueue,
  onSelectLane,
  onSelectCard,
  onToggleCardMode,
}: ContentBankPaneProps) {
  const counts = {
    backlog: board.cards.filter((c) => c.lane === 'backlog').length,
    queued: board.cards.filter((c) => c.lane === 'queued').length,
    done: board.cards.filter((c) => c.lane === 'done').length,
  };

  const visibleCards = board.cards.filter((c) => c.lane === board.activeLane);

  return (
    <section className="tf-col-bank tf-pane ql-surface ql-regular">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2
            className="font-display"
            style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Layers size={15} />
            <span>Content Bank</span>
          </h2>
          <button
            type="button"
            onClick={onToggleAutoQueue}
            className="ql-press tf-btn"
            style={{
              borderRadius: 9999,
              fontWeight: 600,
              background: board.autoQueue ? 'var(--g-prio-bg)' : 'var(--g-sub)',
              color: board.autoQueue ? 'var(--g-prio)' : 'var(--g-sec)',
            }}
          >
            <Sparkles size={13} />
            <span>{board.autoQueue ? 'Auto-Q: ON' : 'Auto-Q: OFF'}</span>
          </button>
        </div>

        <div className="tf-tab-strip" style={{ marginBottom: 8 }}>
          {(['backlog', 'queued', 'done'] as LaneId[]).map((lane) => (
            <button
              key={lane}
              type="button"
              onClick={() => onSelectLane(lane)}
              className={`tf-tab ql-press tabular ${board.activeLane === lane ? 'is-active' : ''}`}
            >
              <span>{lane.charAt(0).toUpperCase() + lane.slice(1)}</span>
              <span>{counts[lane]}</span>
            </button>
          ))}
        </div>

        <div className="kanban-list">
          {loading && (
            <div className="text-sec" style={{ padding: 12, fontSize: 12 }}>
              Scanning workspace shorts &amp; QA reports...
            </div>
          )}
          {!loading && visibleCards.length === 0 && (
            <div className="text-sec" style={{ padding: 12, fontSize: 12 }}>
              No cards in {board.activeLane}. Add a new short below or toggle a card badge.
            </div>
          )}
          {visibleCards.map((card) => {
            const isSelected = card.id === selectedCard?.id;
            const badgeStyle =
              card.audioMode === 'vo_ready'
                ? { background: 'var(--g-prio-bg)', color: 'var(--g-prio)' }
                : { background: 'var(--g-sub)', color: card.audioMode === 'needs_vo' ? 'var(--g-sec)' : 'inherit' };
            const badgeText =
              card.audioMode === 'vo_ready' ? 'VO Ready' : card.audioMode === 'no_vo' ? 'No-VO Mode' : 'Needs VO';

            return (
              <div key={card.id} className={`kanban-row ${isSelected ? 'is-selected' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => onSelectCard(card.id)}
                    className="kanban-select-btn"
                  >
                    {card.title}
                  </button>
                  <span className="text-sec" style={{ fontSize: 12, fontWeight: 500 }}>
                    {card.rigMode === 'stickman' ? 'Stickman' : 'Chibi'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onToggleCardMode(card.id)}
                    className="tf-badge ql-press"
                    style={{ ...badgeStyle, cursor: 'pointer' }}
                  >
                    {card.audioMode === 'no_vo' ? <VolumeX size={12} /> : <Mic size={12} />}
                    <span>{badgeText}</span>
                  </button>
                  <span className="text-sec tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {card.loudness || card.durationLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: '1px solid var(--g-divider)' }}>
        <input
          type="text"
          value={newCardTitle}
          onChange={(e) => onNewCardTitleChange(e.target.value)}
          placeholder="New short title..."
          className="cli-input"
          style={{ padding: '6px 10px' }}
        />
        <button type="button" onClick={onCreateCard} className="ql-surface ql-thin ql-press tf-btn">
          <Plus size={13} />
          <span>Add Card</span>
        </button>
      </div>
    </section>
  );
}
