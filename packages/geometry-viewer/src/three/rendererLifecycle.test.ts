// @vitest-environment node

import type * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  attachRendererContextLifecycle,
  disposeRenderer,
  resetRendererState,
} from "@sp/geometry-viewer/three";

function rendererHarness() {
  const target = new EventTarget();
  const renderListsDispose = vi.fn();
  const renderer = {
    localClippingEnabled: true,
    setScissorTest: vi.fn(),
    clearDepth: vi.fn(),
    resetState: vi.fn(),
    dispose: vi.fn(),
    renderLists: { dispose: renderListsDispose },
    domElement: target,
  } as unknown as THREE.WebGLRenderer;

  return { renderer, target, renderListsDispose };
}

describe("renderer lifecycle", () => {
  it("resets and disposes renderer-owned state", () => {
    const { renderer, renderListsDispose } = rendererHarness();

    resetRendererState(renderer);
    expect(renderer.localClippingEnabled).toBe(false);
    expect(renderer.setScissorTest).toHaveBeenCalledWith(false);
    expect(renderer.clearDepth).toHaveBeenCalledOnce();
    expect(renderer.resetState).toHaveBeenCalledOnce();
    expect(renderListsDispose).toHaveBeenCalledOnce();

    disposeRenderer(renderer);
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("prevents context loss and resets after restoration", () => {
    const { renderer, target } = rendererHarness();
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const detach = attachRendererContextLifecycle(renderer, {
      onContextLost,
      onContextRestored,
    });
    const lostEvent = new Event("webglcontextlost", { cancelable: true });

    target.dispatchEvent(lostEvent);
    target.dispatchEvent(new Event("webglcontextrestored"));

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledOnce();
    expect(onContextRestored).toHaveBeenCalledOnce();
    expect(renderer.resetState).toHaveBeenCalledOnce();

    detach();
    target.dispatchEvent(new Event("webglcontextrestored"));
    expect(onContextRestored).toHaveBeenCalledOnce();
  });
});
