'use client';
import ChatTab from './components/ChatTab';
import DocumentsTab from './components/DocumentsTab';
import Notice from './components/Notice';
import ApprovalsPanel from './components/ApprovalsPanel';
import PendingOperationsPanel from './components/PendingOperationsPanel';
import OverviewTab from './components/OverviewTab';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TransferTab from './components/TransferTab';
import CasesTab from './components/operator/CasesTab';
import { useBananaApp } from './hooks/useBananaApp';

export default function Home() {
  const app = useBananaApp();
  return (
    <div className="app-shell">
      <Sidebar
        operator={app.operator}
        nav={app.nav}
        tab={app.tab}
        conversations={app.conversations}
        conversationId={app.conversationId}
        onNavigate={(id) => (id === 'documents' ? app.openLibrary() : app.setTab(id))}
        onNew={app.newConversation}
        onOpen={app.openConversation}
      />
      <div className="main-shell">
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
              <span className="spinner" /> Getting things ready…
            </div>
          ) : (
            <>
              {app.tab === 'overview' && !app.operator && (
                <OverviewTab
                  name={app.current.name}
                  dashboard={app.dashboard}
                  onChat={() => app.setTab('chat')}
                  onTransfer={() => app.setTab('transfer')}
                />
              )}
              {app.tab === 'chat' && !app.operator && (
                <ChatTab
                  name={app.current.name}
                  conversations={app.conversations}
                  conversationId={app.conversationId}
                  messages={app.messages}
                  busy={app.busy}
                  text={app.text}
                  messagesEnd={app.messagesEnd}
                  onNew={app.newConversation}
                  onOpen={app.openConversation}
                  onSend={app.send}
                  onText={app.setText}
                />
              )}
              {app.tab === 'transfer' && !app.operator && (
                <TransferTab
                  dashboard={app.dashboard}
                  from={app.from}
                  to={app.to}
                  amount={app.amount}
                  concept={app.concept}
                  busy={app.busy}
                  setFrom={app.setFrom}
                  setTo={app.setTo}
                  setAmount={app.setAmount}
                  setConcept={app.setConcept}
                  onSubmit={app.submitTransfer}
                  onOverview={() => app.setTab('overview')}
                />
              )}
              {app.dashboard.approvals?.length > 0 && (
                <ApprovalsPanel
                  approvals={app.dashboard.approvals}
                  accountLabel={app.accountLabel}
                  contactLabel={app.contactLabel}
                  onConfirm={app.confirm}
                />
              )}
              {app.dashboard.pendingOperations?.length > 0 && (
                <PendingOperationsPanel
                  operations={app.dashboard.pendingOperations}
                  contactLabel={app.contactLabel}
                  onCheck={() => app.refresh()}
                />
              )}
              {app.tab === 'overview' && app.operator && (
                <CasesTab
                  name={app.current.name}
                  dashboard={app.dashboard}
                  people={app.people}
                  selectedCase={app.selectedCase}
                  brief={app.brief}
                  busy={app.busy}
                  onOpen={app.openCase}
                  onClose={app.closeCase}
                  onReconcile={app.reconcileCase}
                  onDraft={app.draftBrief}
                />
              )}
              {app.tab === 'documents' && (
                <DocumentsTab
                  operator={app.operator}
                  busy={app.busy}
                  docs={app.docs}
                  document={app.document}
                  query={app.query}
                  sources={app.sources}
                  onIngest={app.updateIndex}
                  onSearch={app.searchDocs}
                  onQuery={app.setQuery}
                  onCloseSources={() => app.setSources(null)}
                  onOpenDoc={app.openDocument}
                />
              )}
            </>
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
