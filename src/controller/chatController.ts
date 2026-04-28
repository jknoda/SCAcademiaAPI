import { type IncomingMessage, type ServerResponse } from 'node:http';
import { HumanMessage } from '@langchain/core/messages';
import { parseJsonBody, sendJson } from './httpUtils.ts';
import { type ControllerContext } from './types.ts';

export async function handleChatRoute(
  request: IncomingMessage,
  response: ServerResponse,
  context: ControllerContext,
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (!(method === 'POST' && pathname === `${context.apiBasePath}/chat`)) {
    return false;
  }

  const body = await parseJsonBody(request);
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const studentText = typeof body.text === 'string' ? body.text.trim() : '';

  if (!userId) {
    sendJson(response, 400, { error: 'Campo userId é obrigatório.' });
    return true;
  }

  if (!studentText) {
    sendJson(response, 400, { error: 'Campo text é obrigatório.' });
    return true;
  }

  const userExists = await context.preferencesService.userExists(userId);
  if (!userExists) {
    sendJson(response, 404, {
      error: `userId não encontrado. Crie o usuário no endpoint POST ${context.apiBasePath}/users.`,
    });
    return true;
  }

  const threadId = context.userThreads.get(userId) || `${userId}-${Date.now()}`;
  context.userThreads.set(userId, threadId);

  await context.preferencesService.ensurePreferencesRecord(userId);

  const userContext = await context.preferencesService.getBasicInfo(userId);
  const result = await context.graph.invoke(
    {
      messages: [new HumanMessage(studentText)],
      userContext,
      userId,
    },
    {
      configurable: { thread_id: threadId },
      context: { userId },
    },
  );

  const effectiveUserId = result.userId || userId;
  if (effectiveUserId !== userId) {
    const accountByContext = await context.preferencesService.getSummary(effectiveUserId);
    const accountEmail = accountByContext?.email;
    if (accountEmail) {
      const existingByEmail = await context.preferencesService.getUserByEmail(accountEmail);
      if (!existingByEmail) {
        await context.preferencesService.createUser(effectiveUserId, accountEmail);
      }
    }
    context.userThreads.set(effectiveUserId, threadId);
  }

  const lastMessage = result.messages[result.messages.length - 1];

  sendJson(response, 200, {
    userId: effectiveUserId,
    threadId,
    studentText,
    aiText: String(lastMessage?.content ?? ''),
  });

  return true;
}