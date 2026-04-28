import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { parseJsonBody, sendJson } from './httpUtils.ts';
import { type ControllerContext } from './types.ts';

export async function handleUsersRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/users`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

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