// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../index');
  vi.doUnmock('three');
  vi.doUnmock('@react-three/fiber');
  vi.doUnmock('@react-three/drei');
  vi.resetModules();
});

it('shares the existing provider and hook identities with renderer consumers', async () => {
  const controls = await import('@sp/configurator/react/controls');
  const lighting = await import('../website/LightingProvider');
  const blinds = await import('../website/PreviewBlindProvider');
  const looks = await import('../website/useSideLookComparison');
  expect(controls.LightingProvider).toBe(lighting.default);
  expect(controls.useLighting).toBe(lighting.useLighting);
  expect(controls.PreviewBlindProvider).toBe(blinds.default);
  expect(controls.usePreviewBlinds).toBe(blinds.usePreviewBlinds);
  expect(controls.useSideLookComparison).toBe(looks.useSideLookComparison);
});

it('loads controls without evaluating the mixed barrel or 3D runtime', async () => {
  vi.resetModules();
  const forbidden = vi.fn(() => { throw new Error('Controls must not load the 3D runtime'); });
  vi.doMock('../index', forbidden);
  vi.doMock('three', forbidden);
  vi.doMock('@react-three/fiber', forbidden);
  vi.doMock('@react-three/drei', forbidden);
  const controls = await import('@sp/configurator/react/controls');
  expect(controls.LightingProvider).toBeTypeOf('function');
  expect(controls.PreviewBlindProvider).toBeTypeOf('function');
  expect(controls.useSideLookComparison).toBeTypeOf('function');
  expect(forbidden).not.toHaveBeenCalled();
});
