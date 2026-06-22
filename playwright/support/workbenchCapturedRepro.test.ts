import { describe, expect, it } from 'vitest';

import { extractWorkbenchCapturedReproPayload } from './workbenchCapturedRepro';

const rawWorkbenchPayload = {
  snapshot: {
    inputs: {
      modules: [{ id: 'module-1' }],
    },
  },
  objectFirst: {
    houseAssembly: {
      houseForms: [{ id: 'house-main' }],
    },
    pergolas: [{ id: 'pergola-1' }],
  },
  selectedState: {
    activeObjectRef: null,
    activePergolaId: null,
    activeModuleIndex: 0,
    viewportMode: 'plan',
  },
  renderDiagnostics: {
    projectPreviewSource: 'project_pipeline',
    houseGeometryInputsById: {
      'house-main': {
        houseFormId: 'house-main',
        failureStage: 'none',
      },
    },
    projectHouseProjectionHealth: [
      {
        houseFormId: 'house-main',
        failureStage: 'none',
      },
    ],
    projectPergolaRenderHealth: [
      {
        pergolaId: 'pergola-1',
        canRenderCommittedBody: true,
      },
    ],
  },
};

const sharedPortalDebugExport = {
  version: 1,
  pageId: 'design-workbench',
  route: '/staff/projects/project-1/design-workbench',
  capturedAt: '2026-06-02T00:00:00.000Z',
  selectedIds: {},
  serverState: {},
  clientState: {},
  diagnostics: {
    workbenchDebugFixture: rawWorkbenchPayload,
  },
  scenario: null,
};

describe('workbenchCapturedRepro', () => {
  it('extracts the workbench fixture payload from a shared portal debug export', () => {
    const payload = extractWorkbenchCapturedReproPayload(sharedPortalDebugExport);

    expect(payload.snapshot).toEqual(rawWorkbenchPayload.snapshot);
    expect(payload.objectFirst).toEqual(rawWorkbenchPayload.objectFirst);
    expect(payload.selectedState).toEqual(rawWorkbenchPayload.selectedState);
    expect(payload.renderDiagnostics.projectPreviewSource).toBe('project_pipeline');
    expect(payload.validation).toEqual({
      houseFormIds: ['house-main'],
      projectPreviewSource: 'project_pipeline',
      projectHouseHealthCount: 1,
      projectPergolaHealthCount: 1,
    });
  });

  it('accepts a raw workbench debug fixture payload for QA fixture routes', () => {
    const payload = extractWorkbenchCapturedReproPayload(rawWorkbenchPayload);

    expect(payload.validation.houseFormIds).toEqual(['house-main']);
  });

  it('rejects payloads without a workbench payload shape', () => {
    expect(() =>
      extractWorkbenchCapturedReproPayload({
        version: 1,
        pageId: 'project-detail',
        diagnostics: {},
      }),
    ).toThrow('workbenchDebugFixture');
  });

  it('rejects workbench payloads without house geometry input diagnostics', () => {
    expect(() =>
      extractWorkbenchCapturedReproPayload({
        ...rawWorkbenchPayload,
        renderDiagnostics: {
          ...rawWorkbenchPayload.renderDiagnostics,
          houseGeometryInputsById: undefined,
        },
      }),
    ).toThrow('renderDiagnostics.houseGeometryInputsById');
  });

  it('rejects workbench payloads without project house health diagnostics', () => {
    expect(() =>
      extractWorkbenchCapturedReproPayload({
        ...rawWorkbenchPayload,
        renderDiagnostics: {
          ...rawWorkbenchPayload.renderDiagnostics,
          projectHouseProjectionHealth: undefined,
        },
      }),
    ).toThrow('renderDiagnostics.projectHouseProjectionHealth');
  });

  it('rejects workbench payloads without project preview source diagnostics', () => {
    expect(() =>
      extractWorkbenchCapturedReproPayload({
        ...rawWorkbenchPayload,
        renderDiagnostics: {
          ...rawWorkbenchPayload.renderDiagnostics,
          projectPreviewSource: undefined,
        },
      }),
    ).toThrow('renderDiagnostics.projectPreviewSource');
  });
});
