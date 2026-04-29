import { createServer } from 'node:http';
import { buildGraph } from './graph/factory.ts';
import { createApiController } from './controller/apiController.ts';
import { AuthService } from './services/authService.ts';

async function main(): Promise<void> {
  try {
    const { graph, preferencesService } = await buildGraph();
    const authService = new AuthService();
    const userThreads = new Map<string, string>();
    const port = Number(process.env.PORT || '3000');
    const apiBasePath = '/api/v1';

    const server = createServer(
      createApiController({
        graph,
        preferencesService,
        authService,
        userThreads,
        apiBasePath,
      })
    );

    server.listen(port, () => {
      console.log(`API iniciada em http://localhost:${port}`);
      console.log(`POST ${apiBasePath}/auth/login -> recebe { email, password } e retorna JWTResponse`);
      console.log(`POST ${apiBasePath}/auth/refreshToken -> recebe { accessToken } e retorna JWTResponse`);
      console.log(`POST ${apiBasePath}/users      -> recebe { email? } e cria userId`);
      console.log(`POST ${apiBasePath}/chat/init  -> recebe { userId } e inicializa conversa`);
      console.log(`POST ${apiBasePath}/chat        -> recebe { userId, text } e retorna resposta da IA`);
    });

    const shutdown = async () => {
      server.close();
      await preferencesService.close();
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void shutdown();
    });

    process.on('SIGTERM', () => {
      void shutdown();
    });

  } catch (error) {
    console.error('\n❌ Erro fatal:', (error as Error).message);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  }
}

main();
