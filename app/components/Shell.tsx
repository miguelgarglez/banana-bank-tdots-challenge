'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import BananaMark from './BananaMark';
import Notice from './Notice';
import ApprovalsPanel from './ApprovalsPanel';
import PendingOperationsPanel from './PendingOperationsPanel';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useApp } from '../providers/AppProvider';

export default function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const pathname = usePathname();
  const segment = pathname.split('/')[1] || 'overview';
  const chatMode = segment === 'assistant' && !app.operator;
  return (
    <div className="app-shell">
      <Sidebar
        operator={app.operator}
        nav={app.nav}
        conversations={app.conversations}
        conversationId={app.conversationId}
        onNew={app.newConversation}
      />
      <div className={`main-shell${chatMode ? ' chat-mode' : ''}`}>
        <TopBar
          operator={app.operator}
          current={app.current}
          people={app.people}
          onSelect={app.selectPerson}
        />
        <main>
          <Notice
            error={app.error}
            notice={app.notice}
            onDismissError={() => app.setError('')}
            onDismissNotice={() => app.setNotice('')}
          />
          {!app.current || !app.dashboard ? (
            <div className="loading">
              <BananaMark size={44} state="loading" /> Getting things ready…
            </div>
          ) : (
            <div className="tab-enter" key={segment}>
              {children}
              {app.dashboard.approvals?.length > 0 &&
                segment !== 'assistant' &&
                segment !== 'transfers' && (
                  <ApprovalsPanel
                    approvals={app.dashboard.approvals}
                    accountLabel={app.accountLabel}
                    contactLabel={app.contactLabel}
                    onConfirm={app.confirm}
                    onDismiss={app.dismiss}
                    busy={app.busy}
                  />
                )}
              {app.dashboard.pendingOperations?.length > 0 && segment !== 'assistant' && (
                <PendingOperationsPanel
                  operations={app.dashboard.pendingOperations}
                  contactLabel={app.contactLabel}
                  onCheck={() => app.refresh()}
                />
              )}
            </div>
          )}
        </main>
        <footer>
          banana<span>A simulated environment for building better experiences.</span>
          <span>banana · 2026</span>
        </footer>
      </div>
    </div>
  );
}
