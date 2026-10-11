import { useState } from 'react';
import type { Person } from '../../src/types';
import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';
import { parseAmount, transferPhase } from '../lib/transfer';
import Avatar from './Avatar';
import Icon from './Icon';
import { TextMorph } from 'torph/react';
import TransferCard from './transfer/TransferCard';
import TransferDone from './transfer/TransferDone';
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

function TransferForm({
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
}) {
  const contacts: AnyRecord[] = dashboard.contacts ?? [];
  const accounts: AnyRecord[] = dashboard.accounts ?? [];
  const groups = new Map<string, { name: string; userId: string; accounts: AnyRecord[] }>();
  for (const c of contacts) {
    const key = String(c.userId ?? c.name);
    if (!groups.has(key)) groups.set(key, { name: c.name, userId: c.userId, accounts: [] });
    groups.get(key)!.accounts.push(c);
  }
  const [picked, setPicked] = useState<string | null>(null);
  const selectedGroup =
    (picked && groups.get(picked)) ||
    [...groups.values()].find((g) => g.accounts.some((a) => a.id === to));
  const cents = parseAmount(amount);
  const fromAccount = accounts.find((a) => a.id === from);
  const remaining = fromAccount && cents !== null ? fromAccount.balanceCents - cents : null;
  const ready = !!to && cents !== null && !!concept.trim() && !busy;
  const pickPerson = (key: string, g: { accounts: AnyRecord[] }) => {
    setPicked(key);
    if (g.accounts.length === 1) setTo(g.accounts[0].id);
    else if (!g.accounts.some((a) => a.id === to)) setTo('');
  };
  return (
    <form
      className="transfer-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="transfer-field">
        <span className="field-label">To</span>
        <div className="recipient-chips">
          {[...groups.entries()].map(([key, g]) => {
            const person = people.find((p) => p.id === g.userId);
            const active = selectedGroup === g;
            return (
              <button
                type="button"
                key={key}
                className="recipient-chip"
                aria-pressed={active}
                onClick={() => pickPerson(key, g)}
              >
                <Avatar
                  initials={person?.initials ?? String(g.name).slice(0, 2)}
                  color={person?.color}
                  size={28}
                />
                {g.name}
              </button>
            );
          })}
        </div>
        {selectedGroup && selectedGroup.accounts.length > 1 && (
          <div className="account-pills">
            {selectedGroup.accounts.map((a) => (
              <button
                type="button"
                key={a.id}
                className="account-pill"
                aria-pressed={a.id === to}
                onClick={() => setTo(a.id)}
              >
                {a.label} <small>{a.id}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="transfer-field">
        <span className="field-label">Amount</span>
        <div className="amount-row">
          <div className="amount-hero-input">
            <span>€</span>
            <input
              aria-label="Amount in euros"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          {remaining !== null && (
            <small className={`amount-after${remaining < 0 ? ' negative' : ''}`}>
              Balance after · <TextMorph>{money(remaining)}</TextMorph>
            </small>
          )}
        </div>
      </div>
      <div className="transfer-field">
        <span className="field-label">From</span>
        <div className="account-options" role="radiogroup" aria-label="From account">
          {accounts.map((a) => (
            <button
              type="button"
              key={a.id}
              className="account-option"
              role="radio"
              aria-checked={a.id === from}
              onClick={() => setFrom(a.id)}
            >
              <span>
                {a.label} <small>{a.id}</small>
              </span>
              <span className="account-option-balance">
                <TextMorph>{money(a.balanceCents)}</TextMorph>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="transfer-field">
        <input
          aria-label="Description"
          className="description-input"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="What is this transfer for?"
          maxLength={200}
          required
        />
      </div>
      <button className="primary-button transfer-submit" disabled={!ready}>
        <span className="button-content">Review transfer</span>
        <Icon name="arrow" />
      </button>
    </form>
  );
}
