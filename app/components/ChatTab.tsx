import type { RefObject } from 'react';
import type { AnyRecord } from '../lib/api';
import { date } from '../lib/format';
import Icon from './Icon';

export default function ChatTab({
  name,
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
  return (
    <div className="chat-layout">
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">ONE CONVERSATION, PLENTY OF POSSIBILITIES</div>
          <h1>Your assistant</h1>
          <p>Ask, plan, and get things done here.</p>
        </div>
        <button className="secondary-button" onClick={onNew}>
          + New conversation
        </button>
      </div>
      <label className="conversation-picker">
        Conversation
        <select
          aria-label="Conversation"
          value={conversationId || ''}
          onChange={(e) => onOpen(e.target.value)}
        >
          <option value="">New conversation</option>
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
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
                <div>
                  {String(m.content)
                    .split(/(\*\*[^*]+\*\*)/g)
                    .map((part, j) =>
                      part.startsWith('**') && part.endsWith('**') ? (
                        <strong key={j}>{part.slice(2, -2)}</strong>
                      ) : (
                        part
                      ),
                    )}
                </div>
                <small>{date(m.created_at)}</small>
              </div>
            </div>
          ))}
          {busy && (
            <div className="message assistant">
              <span className="message-avatar">✧</span>
              <div className="thinking">
                <i />
                <i />
                <i />
                <span>Checking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
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
