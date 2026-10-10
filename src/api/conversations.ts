import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appDb } from '../db';
import { sendMessage } from '../agent/run';
import { defineRoute } from './router';
import { conversationFor } from './shared';

export const conversationRoutes = [
  defineRoute(
    'POST',
    'conversations',
    'customer',
    ({ json, current }) => {
      const id = randomUUID();
      appDb()
        .prepare('INSERT INTO conversations VALUES(?,?,?,?)')
        .run(id, current!.id, 'New conversation', new Date().toISOString());
      return json({ id }, 201);
    },
    'Select a customer to open a chat.',
  ),
  defineRoute(
    'ANY',
    'conversations',
    'customer',
    ({ json, current }) =>
      json(
        appDb()
          .prepare('SELECT * FROM conversations WHERE user_id=? ORDER BY created_at DESC')
          .all(current!.id),
      ),
    'Select a customer to open a chat.',
  ),
  defineRoute(
    'POST',
    'conversations/:id/messages',
    'any',
    async ({ json, current, params, body }) => {
      const conversation = conversationFor(params.id, current!.id);
      const { content } = z
        .object({ content: z.string().trim().min(1).max(8000) })
        .parse(await body());
      if ((conversation as any).title === 'New conversation')
        appDb()
          .prepare('UPDATE conversations SET title=? WHERE id=?')
          .run(content.slice(0, 50), params.id);
      return json(await sendMessage(current!.id, params.id, content));
    },
  ),
  defineRoute('ANY', 'conversations/:id/messages', 'any', ({ json, current, params }) =>
    conversationDetail(json, current!.id, params.id),
  ),
  defineRoute('ANY', 'conversations/:id', 'any', ({ json, current, params }) =>
    conversationDetail(json, current!.id, params.id),
  ),
];

function conversationDetail(
  json: (data: unknown, status?: number) => Response,
  userId: string,
  id: string,
) {
  return json({
    conversation: conversationFor(id, userId),
    messages: appDb()
      .prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at,rowid')
      .all(id),
  });
}
