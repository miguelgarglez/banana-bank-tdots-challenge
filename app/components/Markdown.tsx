import type { ReactNode } from 'react';

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'p'; text: string };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: Math.min(3, heading[1].length) as 1 | 2 | 3,
        text: heading[2],
      });
    } else if (bullet) {
      flushParagraph();
      if (list?.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushParagraph();
      if (list?.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(numbered[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="inline-code">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function Markdown({ text, skipLeadingTitle }: { text: string; skipLeadingTitle?: string }) {
  const blocks = parseMarkdown(text);
  const first = blocks[0];
  if (
    first?.type === 'heading' &&
    first.level === 1 &&
    skipLeadingTitle &&
    (first as Extract<MarkdownBlock, { type: 'heading' }>).text.trim().toLowerCase() ===
      skipLeadingTitle.trim().toLowerCase()
  )
    blocks.shift();
  return (
    <div className="markdown">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const Tag = `h${Math.min(3, block.level + 1)}` as 'h2' | 'h3' | 'h4';
          return <Tag key={i}>{inline(block.text)}</Tag>;
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const Tag = block.type;
          return (
            <Tag key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{inline((block as { text: string }).text)}</p>;
      })}
    </div>
  );
}
