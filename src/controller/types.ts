import { HumanMessage } from '@langchain/core/messages';

export type JsonRecord = Record<string, unknown>;

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

export type ControllerContext = {
  graph: ChatGraph;
  preferencesService: PreferencesServiceContract;
  userThreads: Map<string, string>;
  apiBasePath: string;
};