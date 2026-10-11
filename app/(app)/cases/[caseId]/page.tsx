'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CasesTab from '../../../components/operator/CasesTab';
import RoleGate from '../../../components/RoleGate';
import { useApp } from '../../../providers/AppProvider';

export default function CasePage() {
  const app = useApp();
  const router = useRouter();
  const { caseId } = useParams<{ caseId: string }>();
  useEffect(() => {
    if (!caseId || app.selectedCase?.incident?.id === caseId) return;
    let cancelled = false;
    (async () => {
      const ok = await app.openCase(caseId, { navigate: false });
      if (!ok && !cancelled) router.replace('/cases');
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);
  return (
    <RoleGate role="operator">
      <CasesTab
        name={app.current!.name}
        dashboard={app.dashboard!}
        people={app.people}
        selectedCase={app.selectedCase}
        brief={app.brief}
        busy={app.busy}
        onOpen={app.openCase}
        onClose={app.closeCase}
        onReconcile={app.reconcileCase}
        onDraft={app.draftBrief}
      />
    </RoleGate>
  );
}
