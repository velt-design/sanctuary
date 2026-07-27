import { calculateCostV1 } from '@sp/costing';
import { afterEach, describe, expect, it } from 'vitest';

import { buildModuleCostInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { ModuleDrawingRenderer } from './ModuleViewsCard';
import { buildModuleSectionModel } from './moduleViews';

afterEach(() => {
  document.body.innerHTML = '';
});

function renderCalculatedSection(style: 'pitched' | 'gable') {
  const inputs = makeDefaultCalculatorInputs();
  const module = inputs.modules[0]!;
  module.pergolaStyle = style;
  module.roofPitchDeg = style === 'gable' ? '25' : '8';
  module.projectionM = style === 'gable' ? '5.55' : '3';
  module.gableHouseEdgeGutter = 'house';
  module.gableOuterEdgeGutter = 'our';

  const payload = buildModuleCostInputsFromCalculatorInputs(inputs, 0);
  if (!payload) throw new Error('Expected a calculator module payload.');
  const result = calculateCostV1(payload);
  const sectionModel = buildModuleSectionModel(module, result);
  if (!sectionModel) throw new Error('Expected a calculated Section model.');

  renderIntoDocument(
    <ModuleDrawingRenderer
      view="section"
      status="ready"
      sectionModel={sectionModel}
    />,
  );

  return { explanation: result.derived.rafter_cut_length_explanation!, sectionModel };
}

describe('trusted rafter calculation boundary', () => {
  it('uses the exact costing cut-length fact for the pitched Section annotation and summary', () => {
    const { explanation } = renderCalculatedSection('pitched');
    const expectedMm = Math.round(explanation.planes[0]!.cut_length_m * 1000);
    const dimension = document.querySelector('[data-rafter-dimension-source="costing"]');

    expect(dimension?.getAttribute('data-rafter-cut-length-mm')).toBe(String(expectedMm));
    expect(dimension?.textContent).toContain('Cut');
    expect(document.body.textContent).toContain('Rafter cut:');
    expect(document.body.textContent).toContain(
      `${explanation.planes[0]!.cut_length_m.toFixed(3)}m`,
    );
  });

  it('maps distinct gable house and outer facts to the corresponding two roof annotations', () => {
    const { explanation } = renderCalculatedSection('gable');
    const dimensions = Array.from(
      document.querySelectorAll('[data-rafter-dimension-source="costing"]'),
    );

    expect(explanation.planes.map((item) => item.id)).toEqual(['house', 'outer']);
    expect(dimensions).toHaveLength(2);
    expect(dimensions[0]?.getAttribute('data-rafter-cut-length-mm')).toBe(
      String(Math.round(explanation.planes[0]!.cut_length_m * 1000)),
    );
    expect(dimensions[1]?.getAttribute('data-rafter-cut-length-mm')).toBe(
      String(Math.round(explanation.planes[1]!.cut_length_m * 1000)),
    );
    expect(document.body.textContent).toContain('House');
    expect(document.body.textContent).toContain('Outer');
  });

  it('labels input-fallback geometry as schematic and does not invent an authoritative cut result', () => {
    const inputs = makeDefaultCalculatorInputs();
    const module = inputs.modules[0]!;
    const sectionModel = buildModuleSectionModel(module, null);
    if (!sectionModel) throw new Error('Expected an input-fallback Section model.');

    renderIntoDocument(
      <ModuleDrawingRenderer
        view="section"
        status="ready"
        sectionModel={sectionModel}
      />,
    );

    expect(
      document.querySelector('[data-rafter-dimension-source="schematic"]')?.textContent,
    ).toContain('Slope');
    expect(document.body.textContent).not.toContain('Rafter cut:');
  });
});
