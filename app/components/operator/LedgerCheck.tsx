import { useEffect, useRef, useState } from 'react';
import type { AnyRecord } from '../../lib/api';
import { money } from '../../lib/format';
import Icon from '../Icon';

export default function LedgerCheck({
  reconciliation,
  busy,
  onReconcile,
}: {
  reconciliation: AnyRecord[];
  busy: boolean;
  onReconcile: (intentId: string) => void;
}) {
  const prevRows = useRef<Record<string, { appStatus?: string; finding?: string }>>({});
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const [fadingFindings, setFadingFindings] = useState<Record<string, string>>({});

  useEffect(() => {
    const prev = prevRows.current;
    const nowFlash: string[] = [];
    const nowFading: Record<string, string> = {};
    for (const r of reconciliation ?? []) {
      const before = prev[r.intentId];
      const resolved = r.appStatus === 'completed' && r.bankStatus === 'completed';
      if (before && before.appStatus !== 'completed' && resolved) {
        nowFlash.push(r.intentId);
        if (before.finding && !r.finding) nowFading[r.intentId] = before.finding;
      }
    }
    prevRows.current = Object.fromEntries(
      (reconciliation ?? []).map((r: AnyRecord) => [
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
  }, [reconciliation]);

  if (!reconciliation?.length) return null;
  const glyph = (r: AnyRecord) =>
    r.appStatus === 'completed' && r.bankStatus === 'completed'
      ? { mark: '✓', tone: 'positive' }
      : r.finding
        ? { mark: '⚠', tone: 'warning' }
        : r.bankStatus === 'unverified'
          ? { mark: '○', tone: 'muted' }
          : { mark: '○', tone: 'muted' };
  return (
    <section className="ledger-check">
      <h3>Money check</h3>
      {reconciliation.map((r: AnyRecord) => {
        const g = glyph(r);
        return (
          <div
            className={`ledger-row${flash[r.intentId] ? ' reconciled-flash' : ''}`}
            key={r.intentId}
          >
            <span className={`ledger-glyph ${g.tone}`}>{g.mark}</span>
            <div className="ledger-body">
              <div className="ledger-line">
                {money(r.amountCents)}{' '}
                <small>
                  {r.appStatus} → {r.bankStatus}
                  {r.reference ? ` · ref ${r.reference.slice(0, 8)}` : ''}
                </small>
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
          </div>
        );
      })}
    </section>
  );
}
