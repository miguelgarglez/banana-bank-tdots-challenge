import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import Icon from '../Icon';
import AmountHero from './AmountHero';

export default function TransferDone({
  outcome,
  contacts,
  people,
  onReset,
  onOverview,
}: {
  outcome: AnyRecord;
  contacts: AnyRecord[];
  people: Person[];
  onReset: () => void;
  onOverview: () => void;
}) {
  const payload = outcome.payload;
  const contact = contacts?.find((c) => c.id === payload?.toAccountId);
  const person = contact && people?.find((p) => p.id === contact.userId);
  const reference = outcome.reference ?? outcome.operation?.reference;
  return (
    <>
      {outcome.status === 'completed' ? (
        <>
          <svg className="done-check" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path className="done-check-mark" d="m7 12.5 3.2 3.2L17 8.5" />
          </svg>
          <div className="eyebrow">SENT</div>
          <AmountHero cents={payload?.amountCents ?? 0} />
          <p className="transfer-done-to">
            to {person?.name ?? contact?.name}
            {contact?.label ? ` · ${contact.label}` : ''}
          </p>
          {reference && <p className="transfer-done-ref">Reference {reference.slice(0, 8)}</p>}
        </>
      ) : outcome.status === 'unknown' ? (
        <>
          <span className="done-pending-icon">
            <Icon name="clock" />
          </span>
          <div className="eyebrow">AWAITING BANK CONFIRMATION</div>
          <AmountHero cents={payload?.amountCents ?? 0} size="md" />
          <p className="transfer-done-to">
            The bank has not confirmed yet. We will update it in your activity.
          </p>
        </>
      ) : (
        <>
          <div className="eyebrow">NOT SENT</div>
          <AmountHero cents={payload?.amountCents ?? 0} size="md" />
          <p className="transfer-done-to">{outcome.error}</p>
        </>
      )}
      <div className="transfer-actions">
        <button className="secondary-button" onClick={onReset}>
          New transfer
        </button>
        <button className="text-button" onClick={onOverview}>
          View my accounts ↗
        </button>
      </div>
    </>
  );
}
