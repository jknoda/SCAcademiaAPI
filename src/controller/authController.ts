import { type IncomingMessage, type ServerResponse } from 'node:http';
import { parseJsonBody, sendJson } from './httpUtils.ts';
import { type ControllerContext } from './types.ts';
import { AuthServiceError } from '../services/authService.ts';

export async function handleAuthLoginRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/auth/login`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    sendJson(response, 400, { error: 'Campos email e password são obrigatórios.' });
    return true;
  }

  try {
    const jwtResponse = await context.authService.login(email, password);
    sendJson(response, 200, jwtResponse);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      sendJson(response, error.statusCode, error.payload);
      return true;
    }

    throw error;
  }

  return true;
}

export async function handleAuthRefreshRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/auth/refreshToken`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const accessToken = typeof body.accessToken === 'string'
    ? body.accessToken.trim()
    : url.searchParams.get('accessToken')?.trim() ?? '';

  if (!accessToken) {
    sendJson(response, 400, { error: 'Campo accessToken é obrigatório.' });
    return true;
  }

  try {
    const jwtResponse = await context.authService.refreshToken(accessToken);
    sendJson(response, 200, jwtResponse);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      sendJson(response, error.statusCode, error.payload);
      return true;
    }

    throw error;
  }

  return true;
}