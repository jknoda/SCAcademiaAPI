import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type JsonRecord } from './types.ts';

export function sendJson(response: ServerResponse, statusCode: number, payload: JsonRecord): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

export async function parseJsonBody(request: IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf-8').trim();

  if (!rawBody) {
    return {};
  }

  const parsed = JSON.parse(rawBody);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Corpo JSON inválido. Envie um objeto JSON.');
  }

  return parsed as JsonRecord;
}