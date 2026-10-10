import { z } from 'zod';
import { sessionToken, HttpError } from '../auth';
import { people, person } from '../people';
import { config } from '../config';
import { defineRoute } from './router';

export const sessionRoutes = [
  defineRoute('ANY', 'health', 'none', ({ json }) =>
    json({
      ok: true,
      service: 'banana-app',
      chatModel: config.chatModel,
      embeddingModel: config.embeddingModel,
      keyConfigured: !!process.env.OPENAI_API_KEY,
    }),
  ),
  defineRoute('ANY', 'people', 'none', ({ json }) => json(people)),
  defineRoute('POST', 'session', 'none', async ({ json, body }) => {
    const { userId } = z.object({ userId: z.string() }).parse(await body());
    if (!person(userId)) throw new HttpError(400, 'Unknown person.');
    return json({ person: person(userId) }, 200, {
      'Set-Cookie': `banana_actor=${sessionToken(userId)}; Path=/; HttpOnly; SameSite=Strict`,
    });
  }),
  defineRoute('ANY', 'session', 'any', ({ json, current }) => json({ person: current })),
];
