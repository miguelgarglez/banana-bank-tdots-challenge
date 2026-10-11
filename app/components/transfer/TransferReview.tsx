'use client';
import { useEffect, useState } from 'react';
import { TextMorph } from 'torph/react';
import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import { expiresIn, isExpired } from '../../lib/transfer';
import Avatar from '../Avatar';
import Icon from '../Icon';
import AmountHero from './AmountHero';

export default function TransferReview({
  approval,
  accounts,
  contacts,
  people,
  busy,
  onConfirm,
  onDismiss,
}: {
  approval: AnyRecord;
  accounts: AnyRecord[];
  contacts: AnyRecord[];
  people: Person[];
  busy: boolean;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { payload } = approval;
  const expired = isExpired(approval.expires_at, now);
  const fromAccount = accounts?.find((a) => a.id === payload.fromAccountId);
  const contact = contacts?.find((c) => c.id === payload.toAccountId);
  const person = contact && people?.find((p) => p.id === contact.userId);
  return (
    <>
      <div className="eyebrow">REVIEW AND CONFIRM</div>
      <AmountHero cents={payload.amountCents} />
      <div className="transfer-route">
        <span className="account-leading">{fromAccount?.label?.slice(0, 1)}</span>
        <span>{fromAccount?.label}</span>
        <Icon name="arrow" />
        <Avatar
          initials={person?.initials ?? contact?.name?.slice(0, 2)}
          color={person?.color}
          size={24}
        />
        <span>
          {contact?.name} <small>{contact?.label}</small>
        </span>
      </div>
      <p className="transfer-concept">{payload.concept}</p>
      <div className="transfer-code-row">
        <span>
          Confirmation code <code className="confirmation-code">{approval.confirmationCode}</code>
        </span>
        <small>
          {expired ? (
            'Expired · Edit details to propose again'
          ) : (
            <>
              Expires in <TextMorph>{expiresIn(approval.expires_at, now)}</TextMorph>
            </>
          )}
        </small>
      </div>
      <div className="transfer-actions">
        <button
          className="primary-button"
          disabled={busy || expired}
          onClick={() => onConfirm(approval.id)}
        >
          Confirm transfer
        </button>
        <button className="secondary-button" disabled={busy} onClick={() => onDismiss(approval.id)}>
          Edit details
        </button>
      </div>
      <small className="transfer-note-small">Nothing moves until you confirm.</small>
    </>
  );
}
