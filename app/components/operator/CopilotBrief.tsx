import { useState } from 'react';
import { TextMorph } from 'torph/react';
import type { AnyRecord } from '../../lib/api';

export default function CopilotBrief({
  brief,
  docs,
  onOpenSource,
}: {
  brief: AnyRecord;
  docs: AnyRecord[];
  onOpenSource: (id: string) => void;
}) {
  const [reply, setReply] = useState(brief.draftReply ?? '');
  const [copied, setCopied] = useState(false);
  const rows = Math.min(12, Math.max(3, (reply.match(/\n/g)?.length ?? 0) + 2));
  const copy = async () => {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const resolve = (id: string) => docs.find((d) => d.id === id)?.title;
  return (
    <div className="brief-card">
      <div className="brief-head">
        <h3>Copilot brief</h3>
        {brief.model && <span className="subtle-tag">{brief.model}</span>}
      </div>
      {brief.summary && <p className="brief-summary">{brief.summary}</p>}
      {(
        [
          ['Verified facts', brief.verifiedFacts, 'facts'],
          ['Pending checks', brief.pendingChecks, 'pending'],
          ['Discrepancies', brief.discrepancies, 'discrepancies'],
          ['Suggested actions', brief.suggestedActions, 'actions'],
        ] as const
      ).map(
        ([label, items, cls]) =>
          items?.length > 0 && (
            <div key={label} className={`brief-list ${cls}`}>
              <h4>{label}</h4>
              <ul>
                {(items as string[]).map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ),
      )}
      {brief.draftReply && (
        <>
          <h4>Draft reply</h4>
          <textarea rows={rows} value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="secondary-button" onClick={copy}>
            <TextMorph>{copied ? 'Copied' : 'Copy reply'}</TextMorph>
          </button>
        </>
      )}
      {brief.sources?.length > 0 && (
        <div className="brief-sources">
          {(brief.sources as string[]).map((s: string) =>
            resolve(s) ? (
              <button
                type="button"
                className="citation"
                key={s}
                onClick={() => onOpenSource(s)}
                title={s}
              >
                {resolve(s)} <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <span className="subtle-tag" key={s}>
                {s}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
