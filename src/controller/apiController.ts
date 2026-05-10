import { type IncomingMessage, type ServerResponse } from 'node:http';
import { handleAuthLoginRoute, handleAuthRefreshRoute } from './authController.ts';
import { handleUsersRoute } from './usersController.ts';
import { handleChatRoute } from './chatController.ts';
import { handleChatInitRoute } from './chatInitController.ts';
import { sendJson } from './httpUtils.ts';
import { type AuthenticatedRequest, type ControllerContext } from './types.ts';
import { config } from '../config.ts';

function isProtectedRoute(method: string, pathname: string, apiBasePath: string): boolean {
  return method === 'POST' && [
    `${apiBasePath}/users`,
    `${apiBasePath}/chat/init`,
    `${apiBasePath}/chat`,
  ].includes(pathname);
}

function extractBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export function createApiController({
  graph,
  preferencesService,
  authService,
  userThreads,
  apiBasePath,
}: ControllerContext) {
  const context: ControllerContext = {
    graph,
    preferencesService,
    authService,
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

      if (await handleAuthLoginRoute(request, response, context)) {
        return;
      }

      if (await handleAuthRefreshRoute(request, response, context)) {
        return;
      }

      let authenticatedRequest: AuthenticatedRequest | undefined;
      if (config.auth.validateApiToken && isProtectedRoute(method, pathname, context.apiBasePath)) {
        const accessToken = extractBearerToken(request);
        if (!accessToken) {
          sendJson(response, 401, { error: 'Authorization Bearer token é obrigatório.' });
          return;
        }

        authenticatedRequest = await context.authService.authenticateAccessToken(accessToken);
      }

      if (await handleUsersRoute(request, response, context, authenticatedRequest)) {
        return;
      }

      if (await handleChatInitRoute(request, response, context, authenticatedRequest)) {
        return;
      }

      if (await handleChatRoute(request, response, context, authenticatedRequest)) {
        return;
      }

      sendJson(response, 404, { error: 'Rota não encontrada.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      sendJson(response, 500, { error: message });
    }
  };
}