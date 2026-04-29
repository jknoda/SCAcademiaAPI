import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { parseJsonBody, sendJson } from './httpUtils.ts';
import { type AuthenticatedRequest, type ControllerContext } from './types.ts';

export async function handleUsersRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
  authenticatedRequest?: AuthenticatedRequest,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/users`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const tokenEmail = authenticatedRequest?.tokenEmail?.trim().toLowerCase() ?? '';

  if (requestedEmail && tokenEmail && requestedEmail !== tokenEmail) {
    sendJson(response, 403, { error: 'O email informado difere do email autenticado.' });
    return true;
  }

  const email = requestedEmail || tokenEmail;

  if (email) {
    const existingUser = await context.preferencesService.getUserByEmail(email);
    if (existingUser) {
      context.userThreads.set(
        existingUser.userId,
        context.userThreads.get(existingUser.userId) || `${existingUser.userId}-${Date.now()}`,
      );

      sendJson(response, 200, {
        userId: existingUser.userId,
        email: existingUser.email ?? null,
        message: 'Usuário já existente para este email.',
      });

      return true;
    }
  }

  const userId = randomUUID();
  await context.preferencesService.createUser(userId, email || undefined);
  context.userThreads.set(userId, `${userId}-${Date.now()}`);

  sendJson(response, 201, {
    userId,
    email: email || null,
    message: 'Usuário criado com sucesso.',
  });

  return true;
}