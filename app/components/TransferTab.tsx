import type { Person } from '../../src/types';
import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';
import Avatar from './Avatar';
import Icon from './Icon';
import Select from './Select';

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
}) {
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
        <form
          className="panel transfer-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <h2>Your transfer details</h2>
          <label>
            From account
            <Select
              ariaLabel="From account"
              value={from}
              onChange={setFrom}
              options={dashboard.accounts?.map((a: AnyRecord) => ({
                value: a.id,
                label: a.label,
                description: `${a.id} · ${money(a.balanceCents)}`,
                leading: <span className="account-leading">{a.label.slice(0, 1)}</span>,
              }))}
            />
          </label>
          <label>
            Recipient
            <Select
              ariaLabel="Recipient"
              placeholder="Select an account"
              value={to}
              onChange={setTo}
              options={dashboard.contacts?.map((a: AnyRecord) => {
                const person = people.find((p) => p.id === a.userId);
                return {
                  value: a.id,
                  label: a.label,
                  description: a.id,
                  group: a.name,
                  leading: (
                    <Avatar
                      initials={person?.initials ?? a.name.slice(0, 2)}
                      color={person?.color}
                      size={24}
                    />
                  ),
                };
              })}
            />
          </label>
          <label>
            Amount in euros
            <div className="amount-input">
              <input
                aria-label="Amount in euros"
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <span>EUR</span>
            </div>
          </label>
          <label>
            Description
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="What is this transfer for?"
              maxLength={200}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <span className="button-content">{busy ? 'Sending…' : 'Send transfer'}</span>
            <Icon name="arrow" />
          </button>
        </form>
        <aside className="transfer-note">
          <Icon name="transfer" />
          <h2>
            It is all in
            <br />
            your activity.
          </h2>
          <p>
            Check your activity to see the status of your transfers. If you have any questions, the
            assistant can help.
          </p>
          <button className="text-button" onClick={onOverview}>
            View my accounts ↗
          </button>
        </aside>
      </div>
    </>
  );
}
