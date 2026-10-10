import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';

export default function PendingOperationsPanel({
  operations,
  contactLabel,
  onCheck,
}: {
  operations: AnyRecord[];
  contactLabel: (id: string) => string;
  onCheck: () => void;
}) {
  return (
    <section className="panel approvals">
      <h2>Operations awaiting bank confirmation</h2>
      {operations.map((o: AnyRecord) => (
        <div key={o.intentId}>
          <p>
            <strong>{money(o.payload.amountCents)}</strong> → {contactLabel(o.payload.toAccountId)}
          </p>
          <p>
            {o.payload.concept} · ref {o.reference?.slice(0, 8)}
          </p>
          <button className="secondary-button" onClick={onCheck}>
            Check again
          </button>
        </div>
      ))}
    </section>
  );
}
