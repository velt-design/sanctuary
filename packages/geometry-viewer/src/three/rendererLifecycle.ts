import type * as THREE from "three";

export type RendererContextLifecycleCallbacks = {
  onContextLost?: () => void;
  onContextRestored?: () => void;
};

export function resetRendererState(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  renderer.localClippingEnabled = false;
  renderer.setScissorTest(false);
  renderer.clearDepth();
  renderer.resetState();
  (renderer as { renderLists?: { dispose?: () => void } }).renderLists?.dispose?.();
}

export function disposeRenderer(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  resetRendererState(renderer);
  renderer.dispose();
}

export function attachRendererContextLifecycle(
  renderer: THREE.WebGLRenderer | null,
  callbacks: RendererContextLifecycleCallbacks = {},
): () => void {
  if (!renderer) return () => undefined;

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    callbacks.onContextLost?.();
  };
  const handleContextRestored = () => {
    resetRendererState(renderer);
    callbacks.onContextRestored?.();
  };

  renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

  return () => {
    renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
  };
}
