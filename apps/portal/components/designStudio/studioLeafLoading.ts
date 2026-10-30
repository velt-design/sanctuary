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

const loadEditor = createStudioLeafLoader(() => import('./StudioEditor'));
// Both preload and next/dynamic render use this import site. Separate import
// sites can produce different chunk closures despite naming the same component.
export function loadStudioHouseCanvasModule() {
  return import('./StudioHouseCanvas');
}
const preloadEditorCanvas = createStudioLeafLoader(loadStudioHouseCanvasModule);
export function loadStudioEditor() {
  // The authenticated loader already starts editor code beside its fresh read.
  // Download its actual scene then too, without mounting a renderer or making a
  // failed optional preload prevent the editor's own retryable scene import.
  void preloadEditorCanvas();
  return loadEditor();
}
export const loadSavedStudioReview = createStudioLeafLoader(() => import('./SavedStudioReview'));
export const loadStudioWebsiteReview = createStudioLeafLoader(() => import('./StudioWebsiteReview'));
