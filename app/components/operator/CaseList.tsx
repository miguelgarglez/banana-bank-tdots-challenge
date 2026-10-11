import type { CSSProperties } from 'react';
import type { Person } from '../../../src/types';
import type { AnyRecord } from '../../lib/api';
import { date } from '../../lib/format';

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
  return (
    <section className="panel case-list">
      <div className="section-title">
        <h2>Inbox</h2>
        <span className="subtle-tag">All cases</span>
      </div>
      {incidents?.map((c: AnyRecord, i: number) => (
        <button
          key={c.id}
          className={`case-item stagger-in ${selectedId === c.id ? 'selected' : ''}`}
          style={{ '--i': Math.min(i, 8) } as CSSProperties}
          onClick={() => onOpen(c.id)}
        >
          <span
            className="avatar"
            style={{ background: people.find((p) => p.id === c.user_id)?.color }}
          >
            {people.find((p) => p.id === c.user_id)?.initials}
          </span>
          <div>
            <strong>{people.find((p) => p.id === c.user_id)?.name}</strong>
            <p>{c.summary}</p>
            <small>
              {date(c.created_at)} · {c.status === 'closed' ? 'Resolved' : 'Open'}
            </small>
          </div>
          <span>↗</span>
        </button>
      ))}
    </section>
  );
}
