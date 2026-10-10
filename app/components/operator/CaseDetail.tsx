import type { AnyRecord } from '../../lib/api';
import { date, money } from '../../lib/format';
import Icon from '../Icon';
import CopilotBrief from './CopilotBrief';

export default function CaseDetail({
  selectedCase,
  brief,
  busy,
  onClose,
  onReconcile,
  onDraft,
}: {
  selectedCase: AnyRecord | null;
  brief: AnyRecord | null;
  busy: boolean;
  onClose: () => void;
  onReconcile: (intentId: string) => void;
  onDraft: () => void;
}) {
  return (
    <section className="panel case-detail">
      {selectedCase ? (
        <>
          <div className="eyebrow">CASE {selectedCase.incident.id.slice(0, 12)}</div>
          <h2>{selectedCase.customer.name}</h2>
          <span className="status-pill">
            {selectedCase.incident.status === 'closed' ? 'Resolved' : 'Awaiting support'}
          </span>
          {selectedCase.incident.status === 'open' && (
            <button className="secondary-button" disabled={busy} onClick={onClose}>
              Close case
            </button>
          )}
          <h3>Latest message</h3>
          <blockquote>{selectedCase.lastMessage?.content}</blockquote>
          <p className="muted">Received {date(selectedCase.incident.created_at)}</p>
          {selectedCase.reconciliation?.length > 0 && (
            <>
              <h3>Reconciliation</h3>
              {selectedCase.reconciliation.map((r: AnyRecord) => (
                <div className="reconciliation-row" key={r.intentId}>
                  <div className="evidence-row">
                    {money(r.amountCents)} · {r.appStatus} → {r.bankStatus}
                    <small>{r.reference ? `${r.reference.slice(0, 13)}…` : 'no reference'}</small>
                  </div>
                  {r.finding && <p className="finding">{r.finding}</p>}
                  {r.fixable && (
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => onReconcile(r.intentId)}
                    >
                      Apply reconciliation
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          <h3>Copilot</h3>
          <button className="secondary-button" disabled={busy} onClick={onDraft}>
            {busy ? 'Thinking…' : 'Draft a brief'}
          </button>
          {brief && brief.caseId === selectedCase.incident.id && <CopilotBrief brief={brief} />}
          {selectedCase.history?.length > 0 && (
            <>
              <h3>Conversation</h3>
              {selectedCase.history.map((m: AnyRecord) => (
                <p key={m.id}>
                  <b>{m.role === 'user' ? 'Customer' : 'Assistant'}:</b> {m.content}
                </p>
              ))}
            </>
          )}
          {selectedCase.events?.length > 0 && (
            <>
              <h3>Agent activity</h3>
              {selectedCase.events.map((e: AnyRecord) => (
                <details key={e.id}>
                  <summary>
                    {e.kind} · {date(e.created_at)}
                  </summary>
                  <pre>{JSON.stringify(e.data, null, 2)}</pre>
                </details>
              ))}
            </>
          )}
          {selectedCase.bank && (
            <>
              <h3>Bank operations</h3>
              {selectedCase.bank.operations.map((o: AnyRecord) => (
                <div className="evidence-row" key={o.id}>
                  {money(o.amountCents)} · {o.status}
                  <small>{o.reference}</small>
                </div>
              ))}
            </>
          )}
          {selectedCase.gaps?.map((gap: string) => (
            <p className="muted" key={gap}>
              {gap}
            </p>
          ))}
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
