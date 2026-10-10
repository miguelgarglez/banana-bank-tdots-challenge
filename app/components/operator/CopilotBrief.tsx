import type { AnyRecord } from '../../lib/api';

export default function CopilotBrief({ brief }: { brief: AnyRecord }) {
  return (
    <div className="brief">
      <p>{brief.summary}</p>
      {(
        [
          ['Verified facts', brief.verifiedFacts],
          ['Pending checks', brief.pendingChecks],
          ['Discrepancies', brief.discrepancies],
          ['Suggested actions', brief.suggestedActions],
        ] as const
      ).map(
        ([label, items]) =>
          items?.length > 0 && (
            <div key={label}>
              <h4>{label}</h4>
              <ul>
                {items.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ),
      )}
      {brief.draftReply && (
        <>
          <h4>Draft reply</h4>
          <textarea readOnly rows={6} value={brief.draftReply} />
          <button
            className="text-button"
            onClick={() => navigator.clipboard.writeText(brief.draftReply)}
          >
            Copy reply
          </button>
        </>
      )}
      {brief.sources?.length > 0 && (
        <p>
          {brief.sources.map((s: string) => (
            <span className="subtle-tag" key={s}>
              {s}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
