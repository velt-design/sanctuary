import { describe, expect, it } from 'vitest';
import { prepareLandingDesign } from './landingDesign.server';
import { INITIAL_PRODUCT_SELECTION } from '../../components/products/productSelectionValues';
import { parsePreviewShareHash } from '../../components/configurator-prototype/previewShare';

describe('landing design server boundary', () => {
  it.each(['pitched', 'gable', 'box-perimeter'])('carries exact %s choices to both consumers', type => {
    const result = prepareLandingDesign({ type, selection: { ...INITIAL_PRODUCT_SELECTION, widthMm: 7300, projectionMm: 2800, material: 'combination' } })!;
    expect(result.draft.input).toMatchObject({ widthMm: 7300, projectionMm: 2800 });
    expect(result.draft.roof.finish?.material).toBe('combination');
    for (const href of [result.enquiryHref, result.designerHref]) {
      const url = new URL(href, 'https://www.sanctuarypergolas.co.nz');
      expect(url.searchParams.get('design_scope')).toBe('pergolas-auckland');
      expect(url.searchParams.get('source_path')).toBe('/pergolas-auckland');
      expect(url.searchParams.get('source_product')).toBe(type);
      expect(parsePreviewShareHash(url.hash)?.draft).toEqual(result.draft);
      expect(url.hash).not.toContain('estimate=');
    }
  });
  it('retains full saved details and strips caller prices and private fields', () => {
    const savedDraft = prepareLandingDesign({ type: 'gable', selection: { ...INITIAL_PRODUCT_SELECTION, material: 'solid' } })!.draft;
    savedDraft.roof.infills = true;
    savedDraft.input.level = 'elevated';
    const result = prepareLandingDesign({ type: 'pitched', selection: INITIAL_PRODUCT_SELECTION, savedDraft: { ...savedDraft, amountIncGst: 1, email: 'private@example.invalid' } })!;
    expect(result.restored).toBe(true);
    expect(result.draft).toEqual(savedDraft);
    expect(result.enquiryHref).not.toContain('private');
    expect(result.summary).toContainEqual({ label: 'Gable ends', value: 'Acrylic infills' });
    expect(result.summary).toContainEqual({ label: 'Level', value: 'Elevated' });
  });
  it.each(['gable', 'box-perimeter'])('attributes restored %s from the validated draft rather than fresh-session defaults', type => {
    const savedDraft = prepareLandingDesign({ type, selection: INITIAL_PRODUCT_SELECTION })!.draft;
    const result = prepareLandingDesign({ type:'pitched', selection:INITIAL_PRODUCT_SELECTION, savedDraft })!;
    for (const href of [result.enquiryHref, result.designerHref]) expect(new URL(href, 'https://www.sanctuarypergolas.co.nz').searchParams.get('source_product')).toBe(type);
  });
  it('reports an unsupported projection instead of silently handing off a smaller selection', () => {
    const result = prepareLandingDesign({ type: 'box-perimeter', selection: { ...INITIAL_PRODUCT_SELECTION, projectionMm: 6000, material: 'solid' } })!;
    expect(result.issue).toBeTruthy();
    expect(result.projectionMax).toBeLessThan(6000);
  });
  it.each(['/pergola-cost-auckland', '/pergolas-auckland/redesign', 'https://example.invalid', '//example.invalid', '/contact?token=private', '/unapproved-return'])('only accepts closed landing return paths: %s', sourcePath => {
    const result = prepareLandingDesign({ type: 'gable', selection: INITIAL_PRODUCT_SELECTION, sourcePath })!;
    for (const href of [result.enquiryHref, result.designerHref]) {
      const url = new URL(href, 'https://www.sanctuarypergolas.co.nz');
      expect(url.searchParams.get('source_path')).toBe(['/pergola-cost-auckland', '/pergolas-auckland/redesign'].includes(sourcePath) ? sourcePath : '/pergolas-auckland');
      expect(url.searchParams.get('design_scope')).toBe('pergolas-auckland');
    }
  });
  it.each([null, {}, { type: 'hip', selection: INITIAL_PRODUCT_SELECTION }, { type: 'pitched', selection: { ...INITIAL_PRODUCT_SELECTION, widthMm: 999999 } }, { type: 'pitched', selection: { ...INITIAL_PRODUCT_SELECTION, sides: 'all' } }])('rejects invalid selections', value => {
    expect(prepareLandingDesign(value)).toBeNull();
  });
});
