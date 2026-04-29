import { config } from '../config.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedRequest, JsonRecord, JWTResponse } from '../controller/types.ts';

type HttpErrorPayload = {
  statusCode: number;
  payload: JsonRecord;
};

export class AuthServiceError extends Error {
  readonly statusCode: number;
  readonly payload: JsonRecord;

  constructor(message: string, { statusCode, payload }: HttpErrorPayload) {
    super(message);
    this.name = 'AuthServiceError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function asJsonRecord(value: unknown): JsonRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${'='.repeat(padding)}`, 'base64').toString('utf-8');
}

function getStringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNumericField(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function encodeBase64UrlFromBuffer(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getHmacAlgorithm(jwtAlg: string): 'sha256' | 'sha384' | 'sha512' {
  if (jwtAlg === 'HS256') return 'sha256';
  if (jwtAlg === 'HS384') return 'sha384';
  if (jwtAlg === 'HS512') return 'sha512';

  throw new AuthServiceError('Algoritmo JWT não suportado.', {
    statusCode: 401,
    payload: { error: 'Algoritmo JWT não suportado.' },
  });
}

export class AuthService {
  private readonly baseUrl: string;
  private readonly jwtSecret: string;
  private readonly accessExpiresSeconds: number;

  constructor(baseUrl: string = config.auth.baseUrl) {
    this.baseUrl = baseUrl.trim().replace(/\/$/, '');
    this.jwtSecret = config.auth.jwtSecret;
    this.accessExpiresSeconds = config.auth.accessExpiresSeconds;
  }

  async login(email: string, password: string): Promise<JWTResponse> {
    return this.requestJwtResponse('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }

  async refreshToken(accessToken: string): Promise<JWTResponse> {
    const refreshUrl = `/api/auth/refreshToken?accessToken=${encodeURIComponent(accessToken)}`;
    return this.requestJwtResponse(refreshUrl, { method: 'POST' });
  }

  async authenticateAccessToken(accessToken: string): Promise<AuthenticatedRequest> {
    const token = accessToken.trim();
    const segments = token.split('.');

    if (segments.length !== 3) {
      throw new AuthServiceError('JWT inválido.', {
        statusCode: 401,
        payload: { error: 'JWT inválido.' },
      });
    }

    let claims: JsonRecord;
    let header: JsonRecord;
    try {
      header = asJsonRecord(JSON.parse(decodeBase64Url(segments[0])));
      claims = asJsonRecord(JSON.parse(decodeBase64Url(segments[1])));
    } catch {
      throw new AuthServiceError('JWT inválido.', {
        statusCode: 401,
        payload: { error: 'JWT inválido.' },
      });
    }

    this.verifyJwtSignature(token, header);

    const nowMs = Date.now();
    const exp = getNumericField(claims, 'exp');
    if (typeof exp === 'number' && exp * 1000 <= nowMs) {
      throw new AuthServiceError('JWT expirado.', {
        statusCode: 401,
        payload: { error: 'JWT expirado.' },
      });
    }

    if (typeof exp !== 'number') {
      const iat = getNumericField(claims, 'iat');
      if (typeof iat === 'number' && (iat + this.accessExpiresSeconds) * 1000 <= nowMs) {
        throw new AuthServiceError('JWT expirado.', {
          statusCode: 401,
          payload: { error: 'JWT expirado.' },
        });
      }
    }

    const nestedUser = asJsonRecord(claims.user);
    const tokenEmail = getStringField(claims, 'email') ?? getStringField(nestedUser, 'email');

    return {
      accessToken: token,
      claims,
      tokenEmail,
    };
  }

  private verifyJwtSignature(token: string, header: JsonRecord): void {
    if (!this.jwtSecret) {
      throw new AuthServiceError('JWT_SECRET não configurada.', {
        statusCode: 500,
        payload: { error: 'JWT_SECRET não configurada.' },
      });
    }

    const [encodedHeader, encodedPayload, signature] = token.split('.');
    const alg = getStringField(header, 'alg') ?? '';
    const hmacAlgorithm = getHmacAlgorithm(alg);
    const expectedSignature = encodeBase64UrlFromBuffer(
      createHmac(hmacAlgorithm, this.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest(),
    );

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new AuthServiceError('Assinatura JWT inválida.', {
        statusCode: 401,
        payload: { error: 'Assinatura JWT inválida.' },
      });
    }
  }

  private async requestJwtResponse(path: string, init: RequestInit): Promise<JWTResponse> {
    if (!this.baseUrl) {
      throw new AuthServiceError('AUTH_API_BASE_URL não configurada.', {
        statusCode: 500,
        payload: { error: 'AUTH_API_BASE_URL não configurada.' },
      });
    }

    const response = await fetch(`${this.baseUrl}${path}`, init);
    const payload = asJsonRecord(await response.json().catch(() => ({})));

    if (!response.ok) {
      throw new AuthServiceError('Falha ao autenticar com serviço externo.', {
        statusCode: response.status,
        payload: Object.keys(payload).length ? payload : { error: 'Falha ao autenticar com serviço externo.' },
      });
    }

    const accessToken = getStringField(payload, 'accessToken');
    if (!accessToken) {
      throw new AuthServiceError('Resposta de autenticação inválida.', {
        statusCode: 502,
        payload: { error: 'Resposta de autenticação inválida.' },
      });
    }

    const userRecord = asJsonRecord(payload.user);
    const user = Object.keys(userRecord).length
      ? {
          id: getStringField(userRecord, 'id') ?? '',
          email: getStringField(userRecord, 'email') ?? '',
          fullName: getStringField(userRecord, 'fullName') ?? '',
          role: getStringField(userRecord, 'role') ?? '',
        }
      : undefined;

    return {
      accessToken,
      user,
    };
  }
}