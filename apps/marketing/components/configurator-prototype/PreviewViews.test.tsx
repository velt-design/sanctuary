import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import PreviewViews from './PreviewViews';

vi.mock('next/dynamic', () => ({ default: () => () => <div data-scene /> }));
vi.mock('./useMobileConfigurator', () => ({ useMobileConfigurator: () => false }));
vi.mock('./RailProvider', () => ({ useRail: () => ({ section: 'shape' }) }));
vi.mock('./LightingProvider', () => ({ useLighting: () => null }));
vi.mock('./PreviewBlindProvider', () => ({ usePreviewBlinds: () => null }));
vi.mock('./useDayNightPresentation', () => ({ useDayNightPresentation: () => ({ current: 0, listeners: new Set() }) }));
vi.mock('./PreviewPlan', () => ({ default: () => <div data-plan /> }));
vi.mock('./solvePreview', () => ({
  solvePergolaPreview: ({ widthMm }: { widthMm: number }) => widthMm > 0
    ? { status: 'ready', messages: [], geometry: { assembly: { members: [], roofPlanes: [], roofFlashings: [] }, plan: { members: { rafters: [], posts: [] } }, viewerScene: {} } }
    : { status: 'invalid', messages: [{ message: 'The width needs correction.' }] },
  solveSimpleCoverSurroundings: () => null,
}));

it('removes the camera action when geometry fails and restores it after dimensions recover', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'), root = createRoot(host);
  const render = (widthMm: number) => root.render(<PreviewViews
    input={{ widthMm, projectionMm: 3000, connection: 'fascia', level: 'ground' }}
    roof={{ family: 'gable', orientation: 'parallel', infills: false }}
    activeDimension={null} expanded={false} onToggleExpanded={() => {}} />);
  const cameraAction = () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Look underneath'));
  try {
    await React.act(async () => render(6000));
    expect(host.querySelector('[data-scene]')).not.toBeNull();
    expect(cameraAction()).toBeDefined();
    await React.act(async () => render(0));
    expect(host.textContent).toContain('The width needs correction.');
    expect(host.querySelector('[data-scene]')).toBeNull();
    expect(cameraAction()).toBeUndefined();
    await React.act(async () => render(6000));
    expect(cameraAction()).toBeDefined();
    expect(host.querySelector('[data-scene]')).not.toBeNull();
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
