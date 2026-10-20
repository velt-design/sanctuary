// Keep physical/render owners behind the authenticated loaders' existing wait.
// Failed imports are retryable; a successful leaf keeps its original identity.
export function createStudioLeafLoader<T>(load: () => Promise<{ default: T }>): () => Promise<T | null> {
  let pending: Promise<T | null> | null = null;
  return () => {
    pending ??= Promise.resolve().then(load).then(module => module.default, () => {
      pending = null;
      return null;
    });
    return pending;
  };
}

export const loadStudioEditor = createStudioLeafLoader(() => import('./StudioEditor'));
export const loadSavedStudioReview = createStudioLeafLoader(() => import('./SavedStudioReview'));
export const loadStudioWebsiteReview = createStudioLeafLoader(() => import('./StudioWebsiteReview'));
