import { useEffect, useRef, useState } from 'react';
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
  const prevRows = useRef<Record<string, { appStatus?: string; finding?: string }>>({});
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [fadingFindings, setFadingFindings] = useState<Record<string, string>>({});

  useEffect(() => {
    const prev = prevRows.current;
    const nowFlash: string[] = [];
    const nowFading: Record<string, string> = {};
    for (const r of selectedCase?.reconciliation ?? []) {
      const before = prev[r.intentId];
      const resolved = r.appStatus === 'completed' && r.bankStatus === 'completed';
      if (before && before.appStatus !== 'completed' && resolved) {
        nowFlash.push(r.intentId);
        if (before.finding && !r.finding) nowFading[r.intentId] = before.finding;
      }
    }
    prevRows.current = Object.fromEntries(
      (selectedCase?.reconciliation ?? []).map((r: AnyRecord) => [
        r.intentId,
        { appStatus: r.appStatus, finding: r.finding },
      ]),
    );
    if (!nowFlash.length) return;
    setFlash((f) => ({ ...f, ...Object.fromEntries(nowFlash.map((id) => [id, true])) }));
    if (Object.keys(nowFading).length) {
      setFadingFindings((ff) => ({ ...ff, ...nowFading }));
      const t = setTimeout(
        () =>
          setFadingFindings((ff) => {
            const next = { ...ff };
            for (const id of nowFlash) delete next[id];
            return next;
          }),
        200,
      );
      return () => clearTimeout(t);
    }
  }, [selectedCase]);

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
                <div
                  className={`reconciliation-row${flash[r.intentId] ? ' reconciled-flash' : ''}`}
                  key={r.intentId}
                >
                  <div className="evidence-row">
                    {money(r.amountCents)} · {r.appStatus} → {r.bankStatus}
                    <small>{r.reference ? `${r.reference.slice(0, 13)}…` : 'no reference'}</small>
                  </div>
                  {r.finding && <p className="finding">{r.finding}</p>}
                  {!r.finding && fadingFindings[r.intentId] && (
                    <p className="finding fading">{fadingFindings[r.intentId]}</p>
                  )}
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
            Draft a brief
          </button>
          {busy && (
            <div className="brief-skeleton" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          )}
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
