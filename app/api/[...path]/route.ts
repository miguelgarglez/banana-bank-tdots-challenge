import { dispatch } from '../../../src/api/router';
import { routes } from '../../../src/api/routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return dispatch(request, path.join('/'), routes);
}
export const GET = handler;
export const POST = handler;
