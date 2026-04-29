import { HumanMessage } from '@langchain/core/messages';

export type JsonRecord = Record<string, unknown>;

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

export type JWTResponse = {
  accessToken: string;
  user?: AuthUser;
};

export type AuthenticatedRequest = {
  accessToken: string;
  claims: JsonRecord;
  tokenEmail?: string;
};

export type ChatGraph = {
  invoke: (
    input: {
      messages: HumanMessage[];
      userContext?: string;
      userId: string;
    },
    config: {
      configurable: { thread_id: string };
      context: { userId: string };
    }
  ) => Promise<{
    userId?: string;
    messages: Array<{ content?: unknown }>;
  }>;
};

export type PreferencesServiceContract = {
  getUserByEmail: (email: string) => Promise<{ userId: string; email?: string } | null>;
  createUser: (userId: string, email?: string) => Promise<void>;
  userExists: (userId: string) => Promise<boolean>;
  ensurePreferencesRecord: (userId: string) => Promise<void>;
  getBasicInfo: (userId: string) => Promise<string | undefined>;
  getSummary: (userId: string) => Promise<{ email?: string } | null>;
};

export type AuthServiceContract = {
  login: (email: string, password: string) => Promise<JWTResponse>;
  refreshToken: (accessToken: string) => Promise<JWTResponse>;
  authenticateAccessToken: (accessToken: string) => Promise<AuthenticatedRequest>;
};

export type ControllerContext = {
  graph: ChatGraph;
  preferencesService: PreferencesServiceContract;
  authService: AuthServiceContract;
  userThreads: Map<string, string>;
  apiBasePath: string;
};