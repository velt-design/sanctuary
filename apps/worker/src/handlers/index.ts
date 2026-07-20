import type { BackgroundJobHandlerRegistry } from '../runtime/contracts';

/**
 * JOB-02 starts dark with no domain handlers. Later checkpoints add a handler
 * only when its producer, checkpoints, and finaliser migrate together.
 */
export const backgroundJobHandlers: BackgroundJobHandlerRegistry = Object.freeze({});
