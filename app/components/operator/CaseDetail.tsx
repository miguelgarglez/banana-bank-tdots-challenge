import type { AnyRecord } from '../../lib/api';
import Icon from '../Icon';
import CaseHeader from './CaseHeader';
import CaseTimeline from './CaseTimeline';
import CopilotBrief from './CopilotBrief';
import LedgerCheck from './LedgerCheck';

export default function CaseDetail({
  selectedCase,
  brief,
  busy,
  docs,
  onClose,
  onReconcile,
  onDraft,
  onOpenSource,
}: {
  selectedCase: AnyRecord | null;
  brief: AnyRecord | null;
  busy: boolean;
  docs: AnyRecord[];
  onClose: () => void;
  onReconcile: (intentId: string) => void;
  onDraft: () => void;
  onOpenSource: (id: string) => void;
}) {
  return (
    <section className="panel case-detail">
      {selectedCase ? (
        <>
          <CaseHeader selectedCase={selectedCase} busy={busy} onClose={onClose} onDraft={onDraft} />
          <LedgerCheck
            reconciliation={selectedCase.reconciliation}
            busy={busy}
            onReconcile={onReconcile}
          />
          {busy && (
            <div className="brief-skeleton" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          )}
          {brief && brief.caseId === selectedCase.incident.id && (
            <CopilotBrief brief={brief} docs={docs} onOpenSource={onOpenSource} />
          )}
          <CaseTimeline selectedCase={selectedCase} />
        </>
      ) : (
        <div className="case-empty">
          <Icon name="chat" />
          <h2>Open a case</h2>
          <p>Select a case to see the available information.</p>
        </div>
      )}
    </section>
  );
}
