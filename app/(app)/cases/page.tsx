'use client';
import CasesTab from '../../components/operator/CasesTab';
import RoleGate from '../../components/RoleGate';
import { useApp } from '../../providers/AppProvider';

export default function CasesPage() {
  const app = useApp();
  return (
    <RoleGate role="operator">
      <CasesTab
        dashboard={app.dashboard!}
        people={app.people}
        selectedCase={app.selectedCase}
        brief={app.brief}
        busy={app.busy}
        docs={app.docs}
        onOpen={app.openCase}
        onClose={app.closeCase}
        onReconcile={app.reconcileCase}
        onDraft={app.draftBrief}
        onOpenSource={app.openSource}
      />
    </RoleGate>
  );
}
