import { describe,it,expect } from 'vitest';
import { parseRoofFinish, roofFinishDescription } from './roofFinish';
import { serializePreviewDesign, parsePreviewDesign } from './previewShare';
import { DEFAULT_PREVIEW_DRAFT } from './previewDraft';
import { DEFAULT_ROOF_FINISH } from '@sp/geometry';
import { solvePergolaPreview } from './solvePreview';
describe('ceiling choices',()=>{
  for(const ceiling of ['cedar-100','cedar-150','thermopine-100','thermopine-150'] as const) it(`preserves ${ceiling} through links and geometry`,()=>{
    const draft={...DEFAULT_PREVIEW_DRAFT,roof:{...DEFAULT_PREVIEW_DRAFT.roof,finish:{...DEFAULT_ROOF_FINISH,material:'solid' as const,ceiling}}};
    const parsed=parsePreviewDesign(serializePreviewDesign(draft));
    expect(parsed?.roof.finish?.ceiling).toBe(ceiling);
    expect(roofFinishDescription(draft.roof)).toContain(ceiling.endsWith('100')?'100 mm':'150 mm');
    const solved=solvePergolaPreview(draft.input,draft.roof);
    expect(solved.geometry).toBeTruthy();
  });
  it('rejects an unknown ceiling and accepts older designs without one',()=>{
    expect(parseRoofFinish({...DEFAULT_ROOF_FINISH,ceiling:'wrong'})).toBeNull();
    expect(parseRoofFinish(DEFAULT_ROOF_FINISH)).toEqual(DEFAULT_ROOF_FINISH);
  });
});
