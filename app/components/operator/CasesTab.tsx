import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import CaseDetail from './CaseDetail';
import CaseList from './CaseList';
import { TextMorph } from 'torph/react';

export default function CasesTab({
  dashboard,
  people,
  selectedCase,
  brief,
  busy,
  docs,
  onOpen,
  onClose,
  onReconcile,
  onDraft,
  onOpenSource,
}: {
  dashboard: AnyRecord;
  people: Person[];
  selectedCase: AnyRecord | null;
  brief: AnyRecord | null;
  busy: boolean;
  docs: AnyRecord[];
  onOpen: (id: string) => void;
  onClose: () => void;
  onReconcile: (intentId: string) => void;
  onDraft: () => void;
  onOpenSource: (id: string) => void;
}) {
  return (
    <div className="operator-layout">
      <div className="page-heading operator-heading">
        <div>
          <div className="eyebrow">CUSTOMER SUPPORT</div>
          <h1>Every case, a person.</h1>
        </div>
        <div className="case-count">
          <strong>
            <TextMorph>
              {String(
                dashboard.incidents?.filter((c: AnyRecord) => c.status !== 'closed').length || 0,
              )}
            </TextMorph>
          </strong>
          <span>open cases</span>
        </div>
      </div>
      <div className="operator-grid">
        <CaseList
          incidents={dashboard.incidents}
          people={people}
          selectedId={selectedCase?.incident.id}
          onOpen={onOpen}
        />
        <CaseDetail
          selectedCase={selectedCase}
          brief={brief}
          busy={busy}
          docs={docs}
          onClose={onClose}
          onReconcile={onReconcile}
          onDraft={onDraft}
          onOpenSource={onOpenSource}
        />
      </div>
    </div>
  );
}
