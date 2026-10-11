import type { RefObject } from 'react';
import type { AnyRecord } from '../lib/api';
import { money } from '../lib/format';
import BananaMark from './BananaMark';
import Icon from './Icon';

const SUGGESTIONS = [
  'What fees apply to an urgent SEPA transfer?',
  'Help me write a transfer message',
  'Why was my last transfer declined?',
];

export default function ChatTab({
  name,
  approvals,
  pendingOperations,
  accountLabel,
  contactLabel,
  onConfirm,
  conversations,
  conversationId,
  messages,
  busy,
  text,
  messagesEnd,
  onNew,
  onOpen,
  onSend,
  onText,
}: {
  name: string;
  approvals: AnyRecord[];
  pendingOperations: AnyRecord[];
  accountLabel: (id: string) => string;
  contactLabel: (id: string) => string;
  onConfirm: (id: string) => void;
  conversations: AnyRecord[];
  conversationId: string | null;
  messages: AnyRecord[];
  busy: boolean;
  text: string;
  messagesEnd: RefObject<HTMLDivElement | null>;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSend: (t: string) => void;
  onText: (v: string) => void;
}) {
  return (
    <div className="chat-layout">
      <div className="conversation-picker">
        <label>Conversation</label>
        <select
          value={conversationId ?? ''}
          onChange={(e) => {
            if (e.target.value === 'new') onNew();
            else if (e.target.value) onOpen(e.target.value);
          }}
        >
          {!conversationId && <option value="">Select…</option>}
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
          <option value="new">+ New conversation</option>
        </select>
      </div>
      <section className="chat-panel">
        <div className="chat-head">
          <strong>Banana Assistant</strong>
          <span>
            <span className="status-dot" /> Available now · checks every transfer with you first
          </span>
        </div>
        <div className="messages">
          {!conversationId ? (
            <div className="case-empty">
              <Icon name="chat" />
              <h2>Open a conversation</h2>
              <p>Pick one from the menu or start a new one.</p>
            </div>
          ) : (
            <>
              {messages.length === 0 && !busy && (
                <>
                  <div className="assistant-message">Hi {name.split(' ')[0]}! How can I help?</div>
                  <div className="suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => onSend(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {messages.map((m) => (
                <div className={`message ${m.role}`} key={m.id}>
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="thinking">
                  <BananaMark size={16} state="loading" />
                  <i />
                  <i />
                  <i />
                  <span>Checking…</span>
                </div>
              )}
              <div ref={messagesEnd} />
            </>
          )}
        </div>
        {(approvals?.length > 0 || pendingOperations?.length > 0) && (
          <div className="chat-proposals">
            {approvals?.map((a) => (
              <div className="proposal-card" key={a.id}>
                <strong className="proposal-amount">{money(a.payload.amountCents)}</strong>
                <span>
                  {accountLabel(a.payload.fromAccountId)} → {contactLabel(a.payload.toAccountId)}
                </span>
                <span className="proposal-concept">{a.payload.concept}</span>
                <span>
                  Code: <code className="confirmation-code">{a.confirmationCode}</code>
                </span>
                <button className="primary-button" disabled={busy} onClick={() => onConfirm(a.id)}>
                  <span className="button-content">Confirm these details</span>
                </button>
                <small>Reply with the code or confirm here.</small>
              </div>
            ))}
            {pendingOperations?.map((o) => (
              <div className="proposal-card pending" key={o.intentId}>
                <span>
                  {money(o.payload.amountCents)} to {contactLabel(o.payload.toAccountId)} · awaiting
                  bank confirmation
                </span>
                <small>
                  Ref {o.reference?.slice(0, 8)} · we will update the outcome when the bank ledger
                  is readable again.
                </small>
              </div>
            ))}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            onSend(text);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend(text);
              }
            }}
            placeholder={conversationId ? 'Message the assistant…' : 'Open a conversation first'}
            disabled={!conversationId}
          />
          <button disabled={busy || !conversationId || !text.trim()}>
            <Icon name="send" />
          </button>
        </form>
      </section>
    </div>
  );
}
