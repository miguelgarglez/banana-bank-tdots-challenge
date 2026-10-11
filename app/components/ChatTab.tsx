import { useState, type RefObject } from 'react';
import type { AnyRecord } from '../lib/api';
import { date, money } from '../lib/format';
import BananaMark from './BananaMark';
import Icon from './Icon';
import { Markdown } from './Markdown';
import Select from './Select';

export default function ChatTab({
  name,
  approvals,
  pendingOperations,
  accountLabel,
  contactLabel,
  onConfirm,
  onDismiss,
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
  onDismiss: (id: string) => void;
  conversations: AnyRecord[];
  conversationId: string | null;
  messages: AnyRecord[];
  busy: boolean;
  text: string;
  messagesEnd: RefObject<HTMLDivElement | null>;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSend: (value?: string) => void;
  onText: (value: string) => void;
}) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const scoped = approvals?.filter((a) => a.conversationId === conversationId) ?? [];
  const dismiss = (id: string) => {
    setLeaving(id);
    setTimeout(() => onDismiss(id), 160);
  };
  return (
    <div className="chat-layout">
      <div className="chat-toolbar">
        <h1>Your assistant</h1>
        <div className="chat-toolbar-actions">
          <Select
            ariaLabel="Conversation"
            value={conversationId || ''}
            onChange={(v) => (v === '' ? onNew() : onOpen(v))}
            options={[
              {
                value: '',
                label: 'New conversation',
                leading: <Icon name="chat" />,
              },
              ...conversations.map((c) => ({
                value: c.id as string,
                label: c.title as string,
                description: date(c.created_at),
              })),
            ]}
          />
          <button className="secondary-button" onClick={onNew}>
            + New conversation
          </button>
        </div>
      </div>
      <section className="chat-panel">
        <div className="chat-header">
          <span className="assistant-avatar">✧</span>
          <div>
            <strong>Banana Bank assistant</strong>
            <small>
              <span className="live-dot" /> Here to help
            </small>
          </div>
          <span className="subtle-tag">{name.split(' ')[0]}</span>
        </div>
        <div className="messages">
          {!messages.length && (
            <div className="chat-empty">
              <span className="big-sparkle">✧</span>
              <h2>What do you need today?</h2>
              <p>Start with your accounts or a question.</p>
              <div className="suggestions">
                {[
                  'What are the balances of my accounts?',
                  'When is the Aurora account fee waived?',
                  'I want to speak to a person',
                ].map((s) => (
                  <button key={s} disabled={busy} onClick={() => onSend(s)}>
                    {s}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div className={`message ${m.role}`} key={m.id || i}>
              {m.role === 'assistant' && <span className="message-avatar">✧</span>}
              <div className="bubble">
                <Markdown text={String(m.content)} />
                <small>{date(m.created_at)}</small>
              </div>
            </div>
          ))}
          {busy && (
            <div className="message assistant">
              <span className="message-avatar">✧</span>
              <div className="thinking">
                <BananaMark size={16} state="loading" />
                <i />
                <i />
                <i />
                <span>Checking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
        {(scoped.length > 0 || pendingOperations?.length > 0) && (
          <div className="chat-proposals">
            {scoped.map((a) => (
              <div className={`proposal-card${leaving === a.id ? ' leaving' : ''}`} key={a.id}>
                <strong className="proposal-amount">{money(a.payload.amountCents)}</strong>
                <span>
                  {accountLabel(a.payload.fromAccountId)} → {contactLabel(a.payload.toAccountId)}
                </span>
                <span className="proposal-concept">{a.payload.concept}</span>
                <span>
                  Code: <code className="confirmation-code">{a.confirmationCode}</code>
                </span>
                <div className="proposal-actions">
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => onConfirm(a.id)}
                  >
                    <span className="button-content">Confirm these details</span>
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => dismiss(a.id)}
                  >
                    Not now
                  </button>
                </div>
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
            onSend();
          }}
        >
          <textarea
            aria-label="Message the assistant"
            placeholder="What can we help with?"
            value={text}
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
          />
          <button aria-label="Send message" disabled={busy || !text.trim()}>
            <Icon name="arrow" />
          </button>
        </form>
        <div className="chat-footnote">
          AI assistant · Check important details before taking action.
        </div>
      </section>
    </div>
  );
}
