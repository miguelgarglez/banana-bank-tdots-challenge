import type { CSSProperties } from 'react';
import type { AnyRecord } from '../lib/api';
import Icon from './Icon';

export default function DocumentsTab({
  operator,
  busy,
  docs,
  document,
  query,
  sources,
  onIngest,
  onSearch,
  onQuery,
  onCloseSources,
  onOpenDoc,
}: {
  operator: boolean;
  busy: boolean;
  docs: AnyRecord[];
  document: AnyRecord | null;
  query: string;
  sources: AnyRecord[] | null;
  onIngest: () => void;
  onSearch: () => void;
  onQuery: (v: string) => void;
  onCloseSources: () => void;
  onOpenDoc: (id: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SOURCES AND POLICIES</div>
          <h1>The details, at hand.</h1>
          <p>Read original sources and the excerpts retrieved by the assistant.</p>
        </div>
        {operator && (
          <button className="secondary-button" disabled={busy} onClick={onIngest}>
            {busy ? 'Updating…' : 'Update index'}
          </button>
        )}
      </div>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <Icon name="document" />
        <input
          aria-label="Search documents"
          placeholder="Ask about a policy or search for a product…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button className="primary-button" disabled={busy || !query.trim()}>
          Search
        </button>
      </form>
      {sources && (
        <section className="search-results">
          <div className="section-title">
            <h2>Retrieved excerpts</h2>
            <button className="text-button" onClick={onCloseSources}>
              Close results ×
            </button>
          </div>
          {sources.map((s, i) => (
            <article
              key={s.id}
              className="stagger-in"
              style={{ '--i': Math.min(i, 8) } as CSSProperties}
            >
              <span className="subtle-tag">Similarity {s.score.toFixed(3)}</span>
              <h3>{s.title || 'No title in the index'}</h3>
              <small>
                {s.documentId} · Version {s.version ?? '—'}
              </small>
              <p>{s.text}</p>
            </article>
          ))}
        </section>
      )}
      <div className="documents-layout">
        <section className="panel document-list">
          <div className="section-title">
            <h2>Documents</h2>
            <span>{docs.length} sources</span>
          </div>
          {docs.map((d, i) => (
            <button
              key={d.id}
              className={`stagger-in ${document?.id === d.id ? 'selected' : ''}`}
              style={{ '--i': Math.min(i, 8) } as CSSProperties}
              onClick={() => onOpenDoc(d.id)}
            >
              <Icon name="document" />
              <span>
                <strong>{d.title}</strong>
                <small>
                  v{d.version} ·{' '}
                  {d.validTo ? 'Archive' : d.audience === 'internal' ? 'Internal' : 'Current'}
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
        </section>
        <section className="panel document-reader">
          {document ? (
            <>
              <div className="eyebrow">ORIGINAL SOURCE · V{document.version}</div>
              <h2>{document.title}</h2>
              <p className="muted">
                Effective: {document.validFrom}
                {document.validTo ? ` — ${document.validTo}` : ''}
              </p>
              <pre>{document.text}</pre>
            </>
          ) : (
            <div className="case-empty">
              <Icon name="document" />
              <h2>Open a source</h2>
              <p>Check policies, exceptions, and dates in the original document.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
