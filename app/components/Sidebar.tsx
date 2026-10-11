import { useLayoutEffect, useRef } from 'react';
import type { AnyRecord } from '../lib/api';
import BananaMark from './BananaMark';
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
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const active = navRef.current?.querySelector('.nav-item.active');
    const indicator = indicatorRef.current;
    if (!indicator) return;
    if (active instanceof HTMLElement) {
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translateY(${active.offsetTop}px)`;
      indicator.style.opacity = '1';
    } else {
      indicator.style.opacity = '0';
    }
  }, [tab, nav]);

  return (
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Banana Bank home">
        <span
          className="brand-symbol"
          ref={logoRef}
          onMouseEnter={() => logoRef.current?.classList.add('banana-wiggle')}
          onAnimationEnd={() => logoRef.current?.classList.remove('banana-wiggle')}
        >
          <BananaMark size={28} />
        </span>
        banana<span className="brand-dot">.</span>
      </a>
      <div className="workspace-label">{operator ? 'CUSTOMER SUPPORT' : 'PERSONAL BANKING'}</div>
      <nav ref={navRef}>
        <span className="nav-indicator" ref={indicatorRef} />
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
