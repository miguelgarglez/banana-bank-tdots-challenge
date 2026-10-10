import { z } from 'zod';
import { appDb } from '../db';
import { HttpError } from '../auth';
import { documents, readDocument, ingest } from '../ingestion/pipeline';
import { searchDocuments } from '../retrieval/search';
import { answerWithEvidence } from '../agent/run';
import { allChunks } from '../retrieval/store';
import { defineRoute } from './router';
import type { Person } from '../types';

const FORBIDDEN = 'Operator role required.';

function visible(current: Person) {
  return documents().filter((d) => current.role === 'operator' || d.audience === 'public');
}

export const documentRoutes = [
  defineRoute('ANY', 'documents/:id/chunks', 'any', ({ json, current, params }) => {
    const doc = visible(current!).find((d) => d.id === params.id);
    if (!doc) throw new HttpError(404, 'Document not found.');
    return json(
      allChunks()
        .filter((c) => c.documentId === doc.id)
        .map(({ vector, ...c }) => c),
    );
  }),
  defineRoute('ANY', 'documents/:id', 'any', ({ json, current, params }) => {
    const doc = visible(current!).find((d) => d.id === params.id);
    if (!doc) throw new HttpError(404, 'Document not found.');
    return json({ ...doc, text: readDocument(doc) });
  }),
  defineRoute('ANY', 'documents', 'any', ({ json, current }) =>
    json({
      documents: visible(current!),
      index: appDb().prepare('SELECT COUNT(*) AS chunks FROM chunks').get(),
    }),
  ),
  defineRoute(
    'POST',
    'preview-answer',
    'operator',
    async ({ json, body }) => {
      const parsed = z
        .object({
          question: z.string().min(1).max(8000),
          sources: z
            .array(
              z.object({
                id: z.string(),
                documentId: z.string(),
                text: z.string().max(12000),
                title: z.string().nullable(),
                version: z.number().nullable(),
                validFrom: z.string().nullable(),
                validTo: z.string().nullable(),
                audience: z.enum(['public', 'internal']),
                score: z.number(),
              }),
            )
            .max(10),
        })
        .parse(await body());
      return json(await answerWithEvidence(parsed.question, parsed.sources));
    },
    FORBIDDEN,
  ),
  defineRoute('POST', 'search', 'any', async ({ json, current, body }) => {
    const { query } = z.object({ query: z.string().min(1).max(2000) }).parse(await body());
    return json({
      sources: await searchDocuments(query, current!.role, 5, current!.role === 'operator'),
    });
  }),
  defineRoute('POST', 'ingestion', 'operator', async ({ json }) => json(await ingest()), FORBIDDEN),
];
