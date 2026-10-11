import type { Person } from '../../src/types';
import type { AnyRecord } from '../lib/api';
import { transferPhase } from '../lib/transfer';
import TransferCard from './transfer/TransferCard';
import TransferDone from './transfer/TransferDone';
import TransferForm from './transfer/TransferForm';
import TransferReview from './transfer/TransferReview';

export default function TransferTab({
  dashboard,
  people,
  from,
  to,
  amount,
  concept,
  busy,
  setFrom,
  setTo,
  setAmount,
  setConcept,
  onSubmit,
  onOverview,
  approval,
  outcome,
  onConfirm,
  onDismiss,
  onReset,
}: {
  dashboard: AnyRecord;
  people: Person[];
  from: string;
  to: string;
  amount: string;
  concept: string;
  busy: boolean;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setAmount: (v: string) => void;
  setConcept: (v: string) => void;
  onSubmit: () => void;
  onOverview: () => void;
  approval: AnyRecord | null;
  outcome: AnyRecord | null;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onReset: () => void;
}) {
  const phase = transferPhase(approval, outcome);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM ONE ACCOUNT TO ANOTHER</div>
          <h1>Transfers</h1>
          <p>Send money to another account in this environment.</p>
        </div>
      </div>
      <div className="transfer-layout">
        <TransferCard phase={phase}>
          {phase === 'draft' && (
            <TransferForm
              dashboard={dashboard}
              people={people}
              from={from}
              to={to}
              amount={amount}
              concept={concept}
              busy={busy}
              setFrom={setFrom}
              setTo={setTo}
              setAmount={setAmount}
              setConcept={setConcept}
              onSubmit={onSubmit}
            />
          )}
          {phase === 'review' && approval && (
            <TransferReview
              approval={approval}
              accounts={dashboard.accounts ?? []}
              contacts={dashboard.contacts ?? []}
              people={people}
              busy={busy}
              onConfirm={onConfirm}
              onDismiss={onDismiss}
            />
          )}
          {phase === 'done' && outcome && (
            <TransferDone
              outcome={outcome}
              contacts={dashboard.contacts ?? []}
              people={people}
              onReset={onReset}
              onOverview={onOverview}
            />
          )}
        </TransferCard>
      </div>
    </>
  );
}
