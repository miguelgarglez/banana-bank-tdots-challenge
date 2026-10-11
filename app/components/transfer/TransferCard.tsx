import type { ReactNode } from 'react';
import type { TransferPhase } from '../../lib/transfer';

export default function TransferCard({
  phase,
  compact = false,
  children,
}: {
  phase: TransferPhase;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`transfer-card phase-${phase}${compact ? ' compact' : ''}`}
      aria-live="polite"
    >
      <div className="transfer-card-body" key={phase}>
        {children}
      </div>
    </section>
  );
}
