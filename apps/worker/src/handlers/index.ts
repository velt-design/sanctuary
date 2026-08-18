import type { BackgroundJobHandlerRegistry } from '../runtime/contracts';

import { aiSyntheticHandler } from './aiSynthetic';

/**
 * The synthetic AI handler has no network, provider, business mutation, or
 * external-effect capability. All commercial kinds remain deliberately dark.
 */
export const backgroundJobHandlers: BackgroundJobHandlerRegistry = Object.freeze({
  ai_synthetic_v1: aiSyntheticHandler,
});
