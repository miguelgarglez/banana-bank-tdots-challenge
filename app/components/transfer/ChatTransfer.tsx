import { useState } from 'react';
import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import { money } from '../../lib/format';
import { parseAmount } from '../../lib/transfer';
import TransferCard from './TransferCard';
import TransferDone from './TransferDone';
import TransferForm from './TransferForm';
import TransferReview from './TransferReview';

export type ChatTransferArgs = {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  concept: string;
};

export default function ChatTransfer({
  attachment,
  isLatest,
  dashboard,
  people,
  busy,
  onSubmit,
  onConfirm,
  onDismiss,
  onOverview,
}: {
  attachment: AnyRecord;
  isLatest: boolean;
  dashboard: AnyRecord;
  people: Person[];
  busy: boolean;
  onSubmit: (intentId: string, args: ChatTransferArgs) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onOverview: () => void;
}) {
  const accounts: AnyRecord[] = dashboard.accounts ?? [];
  const contacts: AnyRecord[] = dashboard.contacts ?? [];
  if (attachment.kind === 'draft') {
    if (!isLatest) return null;
    return (
      <DraftCard
        attachment={attachment}
        dashboard={dashboard}
        people={people}
        busy={busy}
        onSubmit={onSubmit}
      />
    );
  }
  const { payload } = attachment;
  const contact = contacts.find((c) => c.id === payload?.toAccountId);
  const name = contact?.name ?? payload?.toAccountId;
  if (attachment.status === 'awaiting_confirmation' && attachment.approval)
    return (
      <TransferCard compact phase="review">
        <TransferReview
          approval={{
            ...attachment.approval,
            payload,
            expires_at: attachment.approval.expiresAt,
            id: attachment.approval.id,
          }}
          accounts={accounts}
          contacts={contacts}
          people={people}
          busy={busy}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      </TransferCard>
    );
  if (['completed', 'unknown', 'failed', 'blocked'].includes(attachment.status))
    return (
      <TransferCard compact phase="done">
        <TransferDone
          outcome={{
            status: attachment.status,
            payload,
            reference: attachment.reference,
            error: attachment.error,
          }}
          contacts={contacts}
          people={people}
          onOverview={onOverview}
        />
      </TransferCard>
    );
  return (
    <TransferCard compact phase="closed">
      <p className="transfer-closed-line">
        {money(payload?.amountCents ?? 0)} to {name} ·{' '}
        {attachment.status === 'cancelled' ? 'Dismissed' : 'Expired'}
      </p>
    </TransferCard>
  );
}

function DraftCard({
  attachment,
  dashboard,
  people,
  busy,
  onSubmit,
}: {
  attachment: AnyRecord;
  dashboard: AnyRecord;
  people: Person[];
  busy: boolean;
  onSubmit: (intentId: string, args: ChatTransferArgs) => void;
}) {
  const { draft } = attachment;
  const [from, setFrom] = useState(draft.fromAccountId ?? dashboard.accounts?.[0]?.id ?? '');
  const [to, setTo] = useState(draft.toAccountId ?? '');
  const [amount, setAmount] = useState(
    draft.amountCents ? (draft.amountCents / 100).toFixed(2) : '',
  );
  const [concept, setConcept] = useState(draft.concept ?? '');
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <>
      <TransferCard compact phase="draft">
        <TransferForm
          compact
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
          onSubmit={() =>
            onSubmit(attachment.id, {
              fromAccountId: from,
              toAccountId: to,
              amountCents: parseAmount(amount)!,
              concept,
            })
          }
        />
      </TransferCard>
      <button className="text-button chat-transfer-dismiss" onClick={() => setHidden(true)}>
        Not now
      </button>
    </>
  );
}
