import type { AnyRecord } from '../../lib/api';
import { eventLabel } from '../../lib/eventLabels';
import { groupTimeline, type TimelineItem } from '../../lib/timeline';
import { date, money, timeAgo } from '../../lib/format';
import Icon from '../Icon';
import { Markdown } from '../Markdown';

const TONE_ICON: Record<string, string> = {
  positive: 'check',
  warning: 'clock',
  danger: 'document',
  neutral: 'document',
};

export default function CaseTimeline({ selectedCase }: { selectedCase: AnyRecord }) {
  const { incident, history = [], events = [], bank, gaps = [] } = selectedCase;
  const items: TimelineItem[] = [];
  for (const m of history)
    items.push({ key: `m-${m.id}`, ts: m.created_at, type: 'message', message: m });
  for (const e of events) {
    const l = eventLabel(e);
    if (!l) continue;
    items.push({ key: `e-${e.id}`, ts: e.created_at, type: 'event', raw: e.data, ...l });
  }
  items.push({ key: 'opened', ts: incident.created_at, type: 'event', label: 'Case opened' });
  if (incident.status === 'closed' && !events.some((e: AnyRecord) => e.kind === 'case.closed'))
    items.push({
      key: 'closed',
      ts: items.at(-1)?.ts ?? incident.created_at,
      type: 'event',
      label: 'Case closed',
    });
  const confirmed = new Set(
    events
      .filter((e: AnyRecord) => e.kind === 'transfer.completed')
      .map((e: AnyRecord) => e.data?.operation?.reference)
      .filter(Boolean),
  );
  for (const o of bank?.operations ?? [])
    if (!confirmed.has(o.reference))
      items.push({
        key: `bank-${o.id}`,
        ts: o.createdAt,
        type: 'event',
        label: `Bank ledger: ${money(o.amountCents)} · ref ${String(o.reference).slice(0, 8)}`,
      });
  items.sort((a, b) => a.ts.localeCompare(b.ts));
  const rows = groupTimeline(items);

  return (
    <ol className="timeline">
      {rows.map((it) =>
        it.type === 'message' ? (
          <li key={it.key} className={`tl-message ${(it.message as AnyRecord).role}`}>
            <small className="tl-caption">
              {(it.message as AnyRecord).role === 'user' ? 'Customer' : 'Assistant'} · {date(it.ts)}
            </small>
            <div className="tl-bubble">
              {(it.message as AnyRecord).role === 'assistant' ? (
                <Markdown text={(it.message as AnyRecord).content} />
              ) : (
                (it.message as AnyRecord).content
              )}
            </div>
          </li>
        ) : (
          <li key={it.key} className={`tl-event ${it.tone ?? 'neutral'}`}>
            <Icon name={TONE_ICON[it.tone ?? 'neutral'] ?? 'document'} />
            <span className="tl-label">
              {it.label}
              {it.count > 1 && <span className="tl-count">×{it.count}</span>}
            </span>
            <time>{timeAgo(it.ts)}</time>
            {it.raws.length > 0 && (
              <details className="tl-raw">
                <summary>Details</summary>
                {it.raws.map((raw, j) => (
                  <pre key={j}>{JSON.stringify(raw, null, 2)}</pre>
                ))}
              </details>
            )}
          </li>
        ),
      )}
      {gaps.map((gap: string) => (
        <li key={gap} className="tl-gap">
          <Icon name="help" />
          {gap}
        </li>
      ))}
    </ol>
  );
}
