import { describe, expect, it } from 'vitest';
import { createDrawingWorkbenchUiState } from './drawingWorkbenchUiState';
import { makeObjectFirstWorkbenchProjectFixture } from './objectFirstWorkbenchFixtures';
import {
  buildDrawingWorkbenchSolvedBase,
  buildDrawingWorkbenchStore,
} from './drawingWorkbenchStore';

function pergolaUi(pergolaId: string, pergolasVisible: boolean) {
  return createDrawingWorkbenchUiState({
    activePergolaId: pergolaId,
    activeObjectRef: { family: 'pergolas', objectId: pergolaId },
    visibility: {
      house: true,
      pergolas: pergolasVisible,
      decks: true,
      openings: true,
    },
  });
}

describe('drawingWorkbenchStore solved base', () => {
  it('reuses solved geometry while deriving new selection and visibility state', () => {
    const solvedBase = buildDrawingWorkbenchSolvedBase({
      projectModel: makeObjectFirstWorkbenchProjectFixture('separate_forms'),
      geometryIdentity: { projectId: 'project-1', estimateId: 'estimate-1' },
    });

    const first = buildDrawingWorkbenchStore({
      ui: pergolaUi('pergola-a', true),
      solvedBase,
    });
    const second = buildDrawingWorkbenchStore({
      ui: pergolaUi('pergola-b', false),
      solvedBase,
    });

    expect(second.derived.solvedModel).toBe(first.derived.solvedModel);
    expect(first.derived.activeObjectFirstPergola?.id).toBe('pergola-a');
    expect(second.derived.activeObjectFirstPergola?.id).toBe('pergola-b');
    expect(first.ui.visibility.pergolas).toBe(true);
    expect(second.ui.visibility.pergolas).toBe(false);
  });
});
