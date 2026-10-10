import { appDb } from '../db';
import { config, referenceDate } from '../config';
import { embedTexts } from './embeddings';
import { allChunks } from './store';
import type { Chunk, SearchResult } from '../types';
export function isCurrent(chunk: Pick<Chunk, 'validFrom' | 'validTo'>, date = referenceDate) {
  return (!chunk.validFrom || chunk.validFrom <= date) && (!chunk.validTo || chunk.validTo >= date);
}
export function diversify<T extends { documentId: string }>(
  ranked: T[],
  limit: number,
  perDocument = 2,
): T[] {
  const counts = new Map<string, number>(),
    result: T[] = [];
  for (const item of ranked) {
    const count = counts.get(item.documentId) || 0;
    if (count >= perDocument) continue;
    counts.set(item.documentId, count + 1);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
export async function searchDocuments(
  query: string,
  role = 'customer',
  limit = 5,
  includeArchived = false,
): Promise<SearchResult[]> {
  const meta = appDb().prepare('SELECT value FROM meta WHERE key=?').get('index-model') as
    { value: string } | undefined;
  if (!meta) throw new Error('No document index. Run npm run setup or npm run ingest.');
  if (meta.value !== config.embeddingModel)
    throw new Error('The model does not match the index. Re-ingest the documents.');
  const [queryVector] = await embedTexts([query]);
  const ranked = allChunks()
    .filter(
      (c) => (role === 'operator' || c.audience === 'public') && (includeArchived || isCurrent(c)),
    )
    .map(({ vector, ...c }) => {
      if (vector!.length !== queryVector.length)
        throw new Error('Incompatible embedding dimensions.');
      const score = vector!.reduce((sum, v, i) => sum + v * queryVector[i], 0);
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
  return diversify(ranked, limit);
}
