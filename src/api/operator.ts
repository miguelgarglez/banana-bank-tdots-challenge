import { z } from 'zod';
import { appDb } from '../db';
import { caseDetail, reconcileIntent, closeCase } from '../operator/view';
import { caseBrief } from '../operator/copilot';
import { defineRoute } from './router';

const FORBIDDEN = 'Operator role required.';

export const operatorRoutes = [
  defineRoute(
    'ANY',
    'incidents',
    'operator',
    ({ json }) => json(appDb().prepare('SELECT * FROM incidents ORDER BY created_at DESC').all()),
    FORBIDDEN,
  ),
  defineRoute(
    'POST',
    'incidents/:id/reconcile',
    'operator',
    async ({ json, current, params, body }) => {
      const { intentId } = z.object({ intentId: z.string() }).parse(await body());
      return json(await reconcileIntent(current!.id, params.id, intentId));
    },
    FORBIDDEN,
  ),
  defineRoute(
    'POST',
    'incidents/:id/close',
    'operator',
    async ({ json, current, params }) => json(await closeCase(current!.id, params.id)),
    FORBIDDEN,
  ),
  defineRoute(
    'POST',
    'incidents/:id/brief',
    'operator',
    async ({ json, current, params }) => json(await caseBrief(current!.id, params.id)),
    FORBIDDEN,
  ),
  defineRoute(
    'ANY',
    'incidents/:id',
    'operator',
    async ({ json, current, params }) => json(await caseDetail(current!.id, params.id)),
    FORBIDDEN,
  ),
];
