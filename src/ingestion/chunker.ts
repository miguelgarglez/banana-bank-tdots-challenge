import { createHash } from 'node:crypto';
import type { Chunk, DocumentRecord } from '../types';
function splitLong(paragraph: string, max: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [paragraph];
  const parts: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (buffer.length + sentence.length > 700 && buffer) {
      parts.push(buffer.trim());
      buffer = '';
    }
    buffer += sentence;
    while (buffer.length > max) {
      parts.push(buffer.slice(0, max).trim());
      buffer = buffer.slice(max);
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
}
export function chunkDocument(doc: DocumentRecord, text: string): Chunk[] {
  const header = `${doc.title} (${doc.id} v${doc.version})\n`;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const groups: string[] = [];
  let buffer = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > 700) {
      if (buffer) {
        groups.push(buffer);
        buffer = '';
      }
      groups.push(...splitLong(paragraph, 1400 - header.length));
    } else if (buffer && buffer.length + paragraph.length + 2 > 700) {
      groups.push(buffer);
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer) groups.push(buffer);
  return groups.map((group, index) => {
    const body = `${header}${group}`;
    return {
      id: createHash('sha256').update(`${doc.id}:${index}:${body}`).digest('hex').slice(0, 24),
      documentId: doc.id,
      text: body,
      title: doc.title,
      version: doc.version,
      validFrom: doc.validFrom,
      validTo: doc.validTo,
      audience: doc.audience,
    };
  });
}
