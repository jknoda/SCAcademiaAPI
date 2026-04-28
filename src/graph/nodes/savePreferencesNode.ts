import type { Runtime } from '@langchain/langgraph';
import type { GraphState } from '../graph.ts';
import { PreferencesService } from '../../services/preferencesService.ts';

export function createSavePreferencesNode(preferencesService: PreferencesService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    if (!state.extractedPreferences) return {};

    const userId = String(state.userId || runtime?.context?.userId || 'unknown');
    const nextUserId = await preferencesService.mergePreferences(userId, state.extractedPreferences);

    return {
      userId: nextUserId || userId,
      extractedPreferences: undefined,
    };
  };
}
