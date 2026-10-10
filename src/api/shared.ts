import { HttpError } from '../auth';
import { appDb } from '../db';

export function conversationFor(id: string, userId: string) {
  const result = appDb()
    .prepare('SELECT * FROM conversations WHERE id=? AND user_id=?')
    .get(id, userId);
  if (!result) throw new HttpError(404, 'Conversation not found.');
  return result;
}
