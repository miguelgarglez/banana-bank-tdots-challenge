import { useState } from 'react';
import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';

export default function ApprovalsPanel({
  approvals,
  accountLabel,
  contactLabel,
  onConfirm,
  onDismiss,
  busy,
}: {
  approvals: AnyRecord[];
  accountLabel: (id: string) => string;
  contactLabel: (id: string) => string;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  busy?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const sorted = [...approvals].sort((x, y) =>
    String(y.createdAt ?? '').localeCompare(String(x.createdAt ?? '')),
  );
  const visible = expanded ? sorted : sorted.slice(0, 2);
  const dismiss = (id: string) => {
    setLeaving(id);
    setTimeout(() => onDismiss(id), 160);
  };
  return (
    <section className="panel approvals">
      <h2>Proposals awaiting confirmation</h2>
      {visible.map((a: AnyRecord) => (
        <div key={a.id} className={leaving === a.id ? 'leaving' : undefined}>
          <p>
            <strong>{money(a.payload.amountCents)}</strong> ·{' '}
            {accountLabel(a.payload.fromAccountId)} → {contactLabel(a.payload.toAccountId)}
          </p>
          <p>
            {a.payload.concept} · Code:{' '}
            <code className="confirmation-code">{a.confirmationCode}</code>
          </p>
          <div className="proposal-actions">
            <button className="primary-button" disabled={busy} onClick={() => onConfirm(a.id)}>
              <span className="button-content">Confirm these details</span>
            </button>
            <button className="secondary-button" disabled={busy} onClick={() => dismiss(a.id)}>
              Not now
            </button>
          </div>
        </div>
      ))}
      {sorted.length > 2 && (
        <button className="text-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `Show ${sorted.length - 2} more`}
        </button>
      )}
    </section>
  );
}
