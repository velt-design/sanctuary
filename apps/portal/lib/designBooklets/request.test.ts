import { describe, expect, it } from 'vitest';
import { TONI_DESIGN_BOOKLET_DRAFT } from './defaults';
import {
  DesignBookletRequestError,
  parseDesignBookletDraft,
  parseDesignBookletFormData,
} from './request';

describe('design booklet request parsing', () => {
  it('accepts the supported template and render ordering fields', () => {
    expect(
      parseDesignBookletDraft({
        customerName: '  Toni  ',
        projectTitle: ' Pool room ',
        roofFormId: 'gable',
        materialId: 'solid-lined',
        renderOrder: ['render-2', 'render-3', 'render-1'],
      }),
    ).toEqual({
      customerName: 'Toni',
      projectTitle: 'Pool room',
      roofFormId: 'gable',
      materialId: 'solid-lined',
      renderOrder: ['render-2', 'render-3', 'render-1'],
    });
  });

  it('falls back safely for unsupported template identifiers and ordering', () => {
    const parsed = parseDesignBookletDraft({
      customerName: '',
      projectTitle: '',
      roofFormId: 'unsupported',
      materialId: 'unsupported',
      renderOrder: ['render-1'],
    });

    expect(parsed).toEqual(TONI_DESIGN_BOOKLET_DRAFT);
  });

  it('rejects an unsupported image type before generating a PDF', async () => {
    const formData = new FormData();
    formData.set('draft', JSON.stringify(TONI_DESIGN_BOOKLET_DRAFT));
    formData.set(
      'asset:plan',
      new File(['not-an-image'], 'plan.svg', { type: 'image/svg+xml' }),
    );

    await expect(parseDesignBookletFormData(formData)).rejects.toBeInstanceOf(
      DesignBookletRequestError,
    );
  });
});
