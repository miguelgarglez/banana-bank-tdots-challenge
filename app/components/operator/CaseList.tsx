import { useState, type CSSProperties } from 'react';
import { TextMorph } from 'torph/react';
import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import Avatar from '../Avatar';

type Filter = 'open' | 'resolved' | 'all';
const FILTERS: [Filter, string][] = [
  ['open', 'Open'],
  ['resolved', 'Resolved'],
  ['all', 'All'],
];
const EMPTY: Record<Filter, string> = {
  open: 'Inbox zero.',
  resolved: 'No resolved cases yet.',
  all: 'No cases yet.',
};

export default function CaseList({
  incidents,
  people,
  selectedId,
  onOpen,
}: {
  incidents: AnyRecord[];
  people: Person[];
  selectedId?: string;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('open');
  const isOpen = (c: AnyRecord) => c.status !== 'closed';
  const counts: Record<Filter, number> = {
    open: incidents.filter(isOpen).length,
    resolved: incidents.filter((c) => !isOpen(c)).length,
    all: incidents.length,
  };
  const rows = incidents
    .filter((c) => filter === 'all' || isOpen(c) === (filter === 'open'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const person = (c: AnyRecord) => people.find((p) => p.id === c.user_id);
  return (
    <section className="panel case-list">
      <div className="section-title">
        <h2>Inbox</h2>
        <div className="segments" role="tablist">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`segment${filter === f ? ' selected' : ''}`}
              onClick={() => setFilter(f)}
            >
              {label} <TextMorph>{String(counts[f])}</TextMorph>
            </button>
          ))}
        </div>
      </div>
      {rows.map((c: AnyRecord, i: number) => (
        <button
          key={c.id}
          className={`case-item stagger-in ${selectedId === c.id ? 'selected' : ''}`}
          style={{ '--i': Math.min(i, 8) } as CSSProperties}
          aria-current={selectedId === c.id ? 'true' : undefined}
          onClick={() => onOpen(c.id)}
        >
          <Avatar initials={person(c)?.initials ?? '?'} color={person(c)?.color} size={32} />
          <div className="case-row">
            <strong>{person(c)?.name}</strong>
            <p>{c.summary}</p>
            <small>
              <span className={`status-dot ${isOpen(c) ? 'open' : 'resolved'}`} />
              {timeAgo(c.created_at)} · {isOpen(c) ? 'Open' : 'Resolved'}
            </small>
          </div>
        </button>
      ))}
      {!rows.length && <p className="case-empty-filter">{EMPTY[filter]}</p>}
    </section>
  );
}
