import { sessionRoutes } from './session';
import { dashboardRoutes } from './dashboard';
import { conversationRoutes } from './conversations';
import { actionRoutes } from './actions';
import { operatorRoutes } from './operator';
import { documentRoutes } from './documents';

export const routes = [
  ...sessionRoutes,
  ...dashboardRoutes,
  ...conversationRoutes,
  ...actionRoutes,
  ...operatorRoutes,
  ...documentRoutes,
];
