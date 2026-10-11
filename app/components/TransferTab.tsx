import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';
import Icon from './Icon';

export default function TransferTab({
  dashboard,
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
            <select value={from} onChange={(e) => setFrom(e.target.value)} required>
              {dashboard.accounts?.map((a: AnyRecord) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.id} · {money(a.balanceCents)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recipient
            <select value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Select an account</option>
              {dashboard.contacts?.map((a: AnyRecord) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.label} · {a.id}
                </option>
              ))}
            </select>
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
