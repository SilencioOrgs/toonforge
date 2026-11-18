import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? <Check size={14} className="ok" /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

/** A command or prompt the user can copy, or hand to the docked agent. */
export function CommandBlock({
  text,
  onSend,
  sendLabel = 'Send to agent',
}: {
  text: string;
  onSend?: (text: string) => void;
  sendLabel?: string;
}) {
  return (
    <div className="cmd">
      <pre className="cmd-text">{text}</pre>
      <div className="cmd-actions">
        <CopyButton text={text} />
        {onSend && (
          <button type="button" className="btn btn-quiet" onClick={() => onSend(text)}>
            <Terminal size={14} />
            <span>{sendLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
