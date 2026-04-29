import { type IncomingMessage, type ServerResponse } from 'node:http';
import { HumanMessage } from '@langchain/core/messages';
import { parseJsonBody, sendJson } from './httpUtils.ts';
import { type AuthenticatedRequest, type ControllerContext } from './types.ts';

async function authorizeUserAccess(
  context: ControllerContext,
  authenticatedRequest: AuthenticatedRequest | undefined,
  userId: string,
): Promise<string | null> {
  const tokenEmail = authenticatedRequest?.tokenEmail?.trim().toLowerCase();
  if (!tokenEmail) {
    return null;
  }

  const linkedUser = await context.preferencesService.getUserByEmail(tokenEmail);
  if (linkedUser && linkedUser.userId !== userId) {
    return 'O userId informado não pertence ao usuário autenticado.';
  }

  return null;
}

const INIT_MESSAGE_WITH_CONTEXT =
  'Inicie a conversa de forma casual mencionando o que você sabe sobre mim e recomende um golpe de judô a ser treinado!';

const INIT_MESSAGE_WITHOUT_CONTEXT =
  'Olá! Me apresente de forma amigável e pergunte sobre meu email, nome, idade, faixa e preferências de técnicas e golpes de judô.';

const RESUME_MESSAGE_WITH_CONTEXT =
  'Retome a conversa de forma natural considerando o histórico e o contexto que você já sabe sobre mim.';

const RESUME_MESSAGE_WITHOUT_CONTEXT =
  'Retome a conversa de forma amigável com base no histórico e continue coletando dados úteis sobre mim.';

export async function handleChatInitRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
  authenticatedRequest?: AuthenticatedRequest,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/chat/init`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';

  if (!userId) {
    sendJson(response, 400, { error: 'Campo userId é obrigatório.' });
    return true;
  }

  const authorizationError = await authorizeUserAccess(context, authenticatedRequest, userId);
  if (authorizationError) {
    sendJson(response, 403, { error: authorizationError });
    return true;
  }

  const userExists = await context.preferencesService.userExists(userId);
  if (!userExists) {
    sendJson(response, 404, {
      error: `userId não encontrado. Crie o usuário no endpoint POST ${context.apiBasePath}/users.`,
    });
    return true;
  }

  const existingThreadId = context.userThreads.get(userId);
  const threadId = existingThreadId || `${userId}-${Date.now()}`;
  context.userThreads.set(userId, threadId);

  await context.preferencesService.ensurePreferencesRecord(userId);

  const userContext = await context.preferencesService.getBasicInfo(userId);
  const initMessage = existingThreadId
    ? (userContext ? RESUME_MESSAGE_WITH_CONTEXT : RESUME_MESSAGE_WITHOUT_CONTEXT)
    : (userContext ? INIT_MESSAGE_WITH_CONTEXT : INIT_MESSAGE_WITHOUT_CONTEXT);

  const result = await context.graph.invoke(
    {
      messages: [new HumanMessage(initMessage)],
      userContext,
      userId,
    },
    {
      configurable: { thread_id: threadId },
      context: { userId },
    },
  );

  const lastMessage = result.messages[result.messages.length - 1];

  sendJson(response, 200, {
    userId,
    threadId,
    aiText: String(lastMessage?.content ?? ''),
  });

  return true;
}
