import { z } from 'zod/v3';

export const SummarySchema = z.object({
  name: z.string().optional().describe('Nome do aluno'),
  email: z.string().email().optional().describe('Email do aluno'),
  age: z.number().optional().describe('Idade do aluno'),
  faixa: z.string().optional().describe('Faixa do aluno'),
  favoriteTechniques: z.array(z.string()).optional().describe('Técnicas favoritas'),
  keyPreferences: z.string().describe('Sumário conciso das preferências de técnicas ou golpes de judô, padrões de humor e hábitos'),
  importantContext: z.string().optional().describe('Qualquer outro contexto importante sobre o aluno'),
});

export type ConversationSummary = z.infer<typeof SummarySchema>;

export const getSummarizationSystemPrompt = () => {
  return JSON.stringify({
    role: 'Sumarizador de conversação para preferências sobre técnicas ou golpes de judô',

    tarefa: 'Analisar conversa e extrair preferências de técnicas e golpes de judô estruturados',

    campos_para_extrair: {
      name: 'Nome do usuário',
      email: 'Email do usuário',
      age: 'Idade do usuário',
      faixa: 'Faixa do usuário',
      favoriteTechniques: 'Todos as técnicas de judô mencionados',
      keyPreferences: 'Sumário de 2-4 frases sobre gostos e contexto de escuta',
      importantContext: 'Outros detalhes relevantes'
    },

    regras: [
      'Combinar informações duplicadas',
      'Ser específico sobre técnicas e golpes de judô',
      'Se atualizando sumário anterior, preservar info não discutida na nova conversa',
      'Incluir apenas informações explicitamente declaradas'
    ]
  });
};

export const getSummarizationUserPrompt = (
  conversationHistory: Array<{ role: string; content: string }>,
  previousSummary?: ConversationSummary
) => {
  return JSON.stringify({
    conversa: conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
    sumario_anterior: previousSummary || 'Nenhum',
    instrucoes: [
      'Atualizar sumário com novas informações desta conversa',
      'Preservar info existente não discutida nas novas mensagens'
    ]
  });
};
