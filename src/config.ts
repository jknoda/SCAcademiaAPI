export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  auth: {
    baseUrl: string;
    jwtSecret: string;
    accessExpiresSeconds: number;
    refreshExpiresSeconds: number;
  };

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };

  models: string[];
  temperature: number;

  memory: {
    dbUri: string;
  };
  maxMessagesToSummary: number;

};

console.assert(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY is not set in environment variables');
console.assert(process.env.JWT_SECRET, 'JWT_SECRET is not set in environment variables');

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: '',
  xTitle: 'IA Devs - Prompt Chaining Article Generator',
  auth: {
    baseUrl: process.env.AUTH_API_BASE_URL?.trim().replace(/\/$/, '') || '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    accessExpiresSeconds: process.env.JWT_ACCESS_EXPIRES ? parseInt(process.env.JWT_ACCESS_EXPIRES) : 3600,
    refreshExpiresSeconds: process.env.JWT_REFRESH_EXPIRES ? parseInt(process.env.JWT_REFRESH_EXPIRES) : 604800,
  },
  models: [
    process.env.LLM_MODEL! ? process.env.LLM_MODEL : 'meta-llama/llama-3.1-8b-instruct'
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0.7,
  memory: {
    dbUri: process.env.DATABASE_URL!,
  },
  maxMessagesToSummary: process.env.MAX_MESSAGES_TO_SUMMARY ? parseInt(process.env.MAX_MESSAGES_TO_SUMMARY) : 4,
};
