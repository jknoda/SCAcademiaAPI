import { type IncomingMessage, type ServerResponse } from 'node:http';
import { handleUsersRoute } from './usersController.ts';
import { handleChatRoute } from './chatController.ts';
import { handleChatInitRoute } from './chatInitController.ts';
import { sendJson } from './httpUtils.ts';
import { type ControllerContext } from './types.ts';

export function createApiController({
  graph,
  preferencesService,
  userThreads,
  apiBasePath,
}: ControllerContext) {
  const context: ControllerContext = {
    graph,
    preferencesService,
    userThreads,
    apiBasePath,
  };

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      if (await handleUsersRoute(request, response, context)) {
        return;
      }

      if (await handleChatInitRoute(request, response, context)) {
        return;
      }

      if (await handleChatRoute(request, response, context)) {
        return;
      }

      sendJson(response, 404, { error: 'Rota não encontrada.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      sendJson(response, 500, { error: message });
    }
  };
}