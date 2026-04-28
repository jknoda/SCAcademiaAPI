export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;

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

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: '',
  xTitle: 'IA Devs - Prompt Chaining Article Generator',
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
