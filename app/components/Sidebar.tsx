import type { AnyRecord } from '../lib/api';
import Icon from './Icon';

export default function Sidebar({
  operator,
  nav,
  tab,
  conversations,
  conversationId,
  onNavigate,
  onNew,
  onOpen,
}: {
  operator: boolean;
  nav: string[][];
  tab: string;
  conversations: AnyRecord[];
  conversationId: string | null;
  onNavigate: (id: string) => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Banana Bank home">
        <span className="brand-symbol" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 32 32">
            <path d="M25 4c1 13-7 22-20 20 6 9 25 1 23-16Z" fill="currentColor" />
            <path d="m24 5 1-3 3 1" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        banana<span className="brand-dot">.</span>
      </a>
      <div className="workspace-label">{operator ? 'CUSTOMER SUPPORT' : 'PERSONAL BANKING'}</div>
      <nav>
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon name={icon} />
            {label}
            {id === 'chat' && <span className="ai-badge">AI</span>}
          </button>
        ))}
      </nav>
      {!operator && (
        <>
          <div className="history-heading">
            CONVERSATIONS
            <button aria-label="New conversation" onClick={onNew}>
              +
            </button>
          </div>
          <div className="conversation-list">
            {conversations.map((c) => (
              <button
                key={c.id}
                className={conversationId === c.id ? 'selected' : ''}
                onClick={() => onOpen(c.id)}
              >
                <span className="conversation-dot" />
                {c.title}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="sidebar-bottom">
        <span className="live-dot" />
        Demo environment<p>Simulated people and money</p>
        <span className="banana-mark">banana / LAB</span>
      </div>
    </aside>
  );
}
