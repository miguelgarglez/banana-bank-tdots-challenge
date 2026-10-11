import type { AnyRecord } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import Avatar from '../Avatar';

export default function CaseHeader({
  selectedCase,
  busy,
  onClose,
  onDraft,
}: {
  selectedCase: AnyRecord;
  busy: boolean;
  onClose: () => void;
  onDraft: () => void;
}) {
  const { incident, customer, reconciliation } = selectedCase;
  const open = incident.status === 'open';
  const pending = reconciliation?.some((r: AnyRecord) => r.fixable);
  return (
    <header className="case-header">
      <Avatar initials={customer?.initials ?? '?'} color={customer?.color} size={40} />
      <div className="case-title">
        <h2>{customer?.name ?? 'Unknown customer'}</h2>
        <small>
          Case {incident.id.slice(0, 8)} · opened {timeAgo(incident.created_at)}
        </small>
      </div>
      <span className={`status-pill ${open ? 'open' : 'resolved'}`}>
        {open ? 'Awaiting support' : 'Resolved'}
      </span>
      <div className="case-actions">
        <button className="primary-button" disabled={busy} onClick={onDraft}>
          Draft a brief
        </button>
        {open && (
          <button
            className="secondary-button"
            disabled={busy || pending}
            title={pending ? 'Apply the pending reconciliation first' : undefined}
            onClick={onClose}
          >
            Close case
          </button>
        )}
      </div>
    </header>
  );
}
