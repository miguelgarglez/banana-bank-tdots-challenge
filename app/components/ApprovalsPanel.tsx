import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';

export default function ApprovalsPanel({
  approvals,
  accountLabel,
  contactLabel,
  onConfirm,
}: {
  approvals: AnyRecord[];
  accountLabel: (id: string) => string;
  contactLabel: (id: string) => string;
  onConfirm: (id: string) => void;
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
            {a.payload.concept} · Code: <strong>{a.confirmationCode}</strong>
          </p>
          <button className="primary-button" onClick={() => onConfirm(a.id)}>
            Confirm these details
          </button>
        </div>
      ))}
    </section>
  );
}
