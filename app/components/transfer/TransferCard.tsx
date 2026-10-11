import type { ReactNode } from 'react';
import type { TransferPhase } from '../../lib/transfer';

export default function TransferCard({
  phase,
  children,
}: {
  phase: TransferPhase;
  children: ReactNode;
}) {
  return (
    <section className={`transfer-card phase-${phase}`} aria-live="polite">
      <div className="transfer-card-body" key={phase}>
        {children}
      </div>
    </section>
  );
}
