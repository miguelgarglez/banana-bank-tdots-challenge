import { z } from 'zod';
import { actor, sameOrigin, HttpError } from '../auth';
import { BankError } from '../banking/client';
import { MissingOpenAIKeyError } from '../retrieval/embeddings';
import type { Person } from '../types';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export type Auth = 'none' | 'any' | 'customer' | 'operator';
export type ApiContext = {
  request: Request;
  params: Record<string, string>;
  current: Person | null;
  body: () => Promise<unknown>;
  json: typeof json;
};
export type Handler = (ctx: ApiContext) => Promise<Response> | Response;
export type Route = {
  method: 'GET' | 'POST' | 'ANY';
  pattern: string;
  auth: Auth;
  forbidden?: string;
  handler: Handler;
};
export const defineRoute = (
  method: Route['method'],
  pattern: string,
  auth: Auth,
  handler: Handler,
  forbidden?: string,
): Route => ({ method, pattern, auth, handler, forbidden });

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/'),
    s = path.split('/');
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = s[i];
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export async function dispatch(request: Request, path: string, routes: Route[]) {
  try {
    if (request.method === 'POST') sameOrigin(request);
    for (const route of routes) {
      if (route.method !== 'ANY' && route.method !== request.method) continue;
      const params = match(route.pattern, path);
      if (!params) continue;
      let current: Person | null = null;
      if (route.auth !== 'none') {
        current = actor(request);
        if (route.auth !== 'any' && current.role !== route.auth)
          throw new HttpError(403, route.forbidden || 'Forbidden.');
      }
      return await route.handler({
        request,
        params,
        current,
        body: () => request.json(),
        json,
      });
    }
    throw new HttpError(404, 'Route not found.');
  } catch (e) {
    if (e instanceof MissingOpenAIKeyError)
      return json({ error: e.message, code: 'missing_openai_api_key' }, 503);
    if (e instanceof HttpError || e instanceof BankError)
      return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return json({ error: 'Invalid request data.' }, 400);
    console.error('app_request_failed', e instanceof Error ? e.name : 'unknown');
    return json(
      { error: 'The request could not be completed. Check the service and configuration.' },
      500,
    );
  }
}
