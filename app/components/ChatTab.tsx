import { useEffect, useRef, type RefObject } from 'react';
import type { Person } from '../../src/types';
import type { AnyRecord } from '../lib/api';
import { date } from '../lib/format';
import BananaMark from './BananaMark';
import Icon from './Icon';
import { Markdown, type Citations } from './Markdown';
import Select from './Select';
import ChatTransfer, { type ChatTransferArgs } from './transfer/ChatTransfer';

export default function ChatTab({
  dashboard,
  people,
  onTransferSubmit,
  onConfirm,
  onDismiss,
  onOverview,
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
  docs,
  onOpenSource,
}: {
  dashboard: AnyRecord;
  people: Person[];
  onTransferSubmit: (intentId: string, args: ChatTransferArgs) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onOverview: () => void;
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
  docs: AnyRecord[];
  onOpenSource: (id: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (text === '' && textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text]);
  const citations: Citations = {
    resolve: (id) => {
      const d = docs.find((x) => x.id === id);
      return d ? { title: String(d.title) } : null;
    },
    onOpen: onOpenSource,
  };
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const pendingCode = messages
    .flatMap((m) => m.transfers ?? [])
    .find(
      (t: AnyRecord) => t.kind === 'intent' && t.status === 'awaiting_confirmation' && t.approval,
    )?.approval?.confirmationCode;
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
          <strong>Banana Bank assistant</strong>
          <small>
            <span className="live-dot" /> Here to help
          </small>
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
              <div className="message-body">
                <div className="bubble">
                  <Markdown
                    text={String(m.content)}
                    citations={m.role === 'assistant' ? citations : undefined}
                  />
                  <small>{date(m.created_at)}</small>
                </div>
                {m.role === 'assistant' &&
                  m.transfers?.map((t: AnyRecord) => (
                    <div className="chat-transfer" key={t.id}>
                      <ChatTransfer
                        attachment={t}
                        isLatest={m === lastAssistant}
                        dashboard={dashboard}
                        people={people}
                        busy={busy}
                        onSubmit={onTransferSubmit}
                        onConfirm={onConfirm}
                        onDismiss={onDismiss}
                        onOverview={onOverview}
                      />
                    </div>
                  ))}
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
        <div className="chat-footer">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <textarea
              ref={textareaRef}
              aria-label="Message the assistant"
              placeholder={
                pendingCode
                  ? `Type "confirm ${pendingCode}" or confirm on the card`
                  : 'What can we help with?'
              }
              value={text}
              onChange={(e) => {
                onText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
            />
            <button aria-label="Send message" disabled={busy || !text.trim()}>
              <Icon name="arrow" />
            </button>
          </form>
          <div className="chat-footnote">
            AI assistant · Check important details before taking action.
          </div>
        </div>
      </section>
    </div>
  );
}
