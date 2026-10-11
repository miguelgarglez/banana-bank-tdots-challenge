import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';

export default function ApprovalsPanel({
  approvals,
  accountLabel,
  contactLabel,
  onConfirm,
  busy,
}: {
  approvals: AnyRecord[];
  accountLabel: (id: string) => string;
  contactLabel: (id: string) => string;
  onConfirm: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <section className="panel approvals">
      <h2>Proposals awaiting confirmation</h2>
      {approvals.map((a: AnyRecord) => (
        <div key={a.id}>
          <p>
            <strong>{money(a.payload.amountCents)}</strong> ·{' '}
            {accountLabel(a.payload.fromAccountId)} → {contactLabel(a.payload.toAccountId)}
          </p>
          <p>
            {a.payload.concept} · Code:{' '}
            <code className="confirmation-code">{a.confirmationCode}</code>
          </p>
          <button className="primary-button" disabled={busy} onClick={() => onConfirm(a.id)}>
            <span className="button-content">Confirm these details</span>
          </button>
        </div>
      ))}
    </section>
  );
}
