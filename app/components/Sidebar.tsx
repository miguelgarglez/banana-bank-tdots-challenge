'use client';
import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AnyRecord } from '../lib/api';
import BananaMark from './BananaMark';
import Icon from './Icon';

export default function Sidebar({
  operator,
  nav,
  conversations,
  conversationId,
  onNew,
}: {
  operator: boolean;
  nav: string[][];
  conversations: AnyRecord[];
  conversationId: string | null;
  onNew: () => void;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
  }, [pathname, nav]);

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
        {nav.map(([id, icon, label, href]) => (
          <Link key={id} href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`}>
            <Icon name={icon} />
            {label}
            {id === 'chat' && <span className="ai-badge">AI</span>}
          </Link>
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
              <Link
                key={c.id}
                href={`/assistant/${c.id}`}
                className={conversationId === c.id ? 'selected' : ''}
              >
                <span className="conversation-dot" />
                {c.title}
              </Link>
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
