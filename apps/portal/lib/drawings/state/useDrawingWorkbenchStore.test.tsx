import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { createDrawingWorkbenchUiState } from './drawingWorkbenchUiState';
import { makeObjectFirstWorkbenchProjectFixture } from './objectFirstWorkbenchFixtures';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import { useDrawingWorkbenchStore } from './useDrawingWorkbenchStore';

type StoreResult = ReturnType<typeof useDrawingWorkbenchStore>;

let latest: StoreResult | null = null;

function Probe({ projectModel, selectedPergolaId }: {
  projectModel: WorkbenchProjectModel;
  selectedPergolaId: string;
}) {
  latest = useDrawingWorkbenchStore({
    projectModel,
    ui: createDrawingWorkbenchUiState({
      activePergolaId: selectedPergolaId,
      activeObjectRef: { family: 'pergolas', objectId: selectedPergolaId },
    }),
  });
  return <div data-selected-pergola={latest.store.derived.activeObjectFirstPergola?.id ?? ''} />;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
});

describe('useDrawingWorkbenchStore', () => {
  it('keeps solved geometry stable for UI-only selection changes', () => {
    const projectModel = makeObjectFirstWorkbenchProjectFixture('separate_forms');
    const rendered = renderIntoDocument(
      <Probe projectModel={projectModel} selectedPergolaId="pergola-a" />,
    );
    const firstSolvedModel = latest?.store.derived.solvedModel;

    rendered.rerender(
      <Probe projectModel={projectModel} selectedPergolaId="pergola-b" />,
    );

    expect(latest?.store.derived.solvedModel).toBe(firstSolvedModel);
    expect(latest?.store.derived.activeObjectFirstPergola?.id).toBe('pergola-b');
    rendered.unmount();
  });
});
