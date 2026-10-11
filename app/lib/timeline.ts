export type TimelineItem = {
  key: string;
  ts: string;
  type: 'message' | 'event' | 'gap';
  label?: string;
  tone?: string;
  [k: string]: unknown;
};

export type TimelineRow = TimelineItem & { count: number; raws: unknown[] };

// Collapses consecutive event items that share the same label into one row.
export function groupTimeline(items: TimelineItem[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const it of items) {
    const prev = rows.at(-1);
    if (
      it.type === 'event' &&
      it.label !== undefined &&
      prev?.type === 'event' &&
      prev.label === it.label
    ) {
      prev.count += 1;
      prev.ts = it.ts;
      if (it.raw !== undefined) prev.raws.push(it.raw);
      prev.key = it.key;
      continue;
    }
    rows.push({ ...it, count: 1, raws: it.raw !== undefined ? [it.raw] : [] });
  }
  return rows;
}
