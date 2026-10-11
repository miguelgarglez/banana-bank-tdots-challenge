import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import CaseDetail from './CaseDetail';
import CaseList from './CaseList';
import { TextMorph } from 'torph/react';

export default function CasesTab({
  name,
  dashboard,
  people,
  selectedCase,
  brief,
  busy,
  onOpen,
  onClose,
  onReconcile,
  onDraft,
}: {
  name: string;
  dashboard: AnyRecord;
  people: Person[];
  selectedCase: AnyRecord | null;
  brief: AnyRecord | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onReconcile: (intentId: string) => void;
  onDraft: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER SUPPORT</div>
          <h1>Every case, a person.</h1>
          <p>Hello, {name.split(' ')[0]}. Here are your customer support cases.</p>
        </div>
        <div className="case-count">
          <strong>
            <TextMorph>
              {String(
                dashboard.incidents?.filter((c: AnyRecord) => c.status === 'open').length || 0,
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
          onClose={onClose}
          onReconcile={onReconcile}
          onDraft={onDraft}
        />
      </div>
    </>
  );
}
