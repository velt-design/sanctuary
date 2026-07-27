import type {
  TrustedLabourBreakdownV1,
  TrustedMaterialsBreakdownV1,
} from '@sp/costing';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  CalculatorLabourBreakdown,
  CalculatorMaterialsBreakdown,
} from './CalculatorTrustedBreakdowns';

function materials(
  overrides: Partial<TrustedMaterialsBreakdownV1> = {},
): TrustedMaterialsBreakdownV1 {
  return {
    version: 1,
    status: 'ready',
    source: '@sp/costing/materials-v1',
    scope: 'whole_job',
    row_count: 1,
    assumptions: ['Whole-job procurement output.'],
    groups: [{
      id: 'structure',
      label: 'Structure & framing',
      rows: [{
        instance_id: 'm1.rafter-stock#1',
        id: 'm1.rafter-stock',
        label: '100x50 4m (Black)',
        owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
        quantity: 11,
        unit: 'bar',
        profile: '100x50',
        internal_cost_ex_gst: 839.06,
        explanation: {
          version: 1,
          source: '@sp/costing/materials-v1',
          summary: 'The stock allocator packed the required rafter cuts into whole bars.',
          facts: [
            { label: 'Required cuts', value: 31.57, unit: 'm' },
            { label: 'Stock length', value: 4, unit: 'm' },
            { label: 'Allocated waste', value: 12.43, unit: 'm' },
          ],
          assumptions: [],
          rounding: 'Stock is purchased in whole bars.',
        },
      }],
    }],
    ...overrides,
  };
}

function labour(
  overrides: Partial<TrustedLabourBreakdownV1> = {},
): TrustedLabourBreakdownV1 {
  return {
    version: 1,
    status: 'ready',
    source: '@sp/costing/install-actions-v1',
    scope: 'whole_job',
    action_count: 1,
    total_crew_minutes: 158.55,
    total_crew_hours: 2.64,
    assumptions: ['Whole-job crew estimate.'],
    groups: [{
      id: 'roofing',
      label: 'Roof installation',
      crew_minutes: 158.55,
      crew_hours: 2.64,
      rows: [{
        instance_id: 'm1.rafters.install#1',
        id: 'm1.rafters.install',
        label: 'Cut + install rafter',
        owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
        quantity: 11,
        unit: 'rafter',
        minutes: 158.55,
        crew_hours: 2.64,
        internal_cost_ex_gst: 198.19,
        relevant_multipliers: [
          { id: 'pitch_steep_roof', label: 'Steep roof pitch', factor: 1.3 },
        ],
        explanation: {
          version: 1,
          source: '@sp/costing/install-actions-v1',
          summary: 'The module’s calculated rafter count drives this activity.',
          facts: [
            { label: 'Activity quantity', value: 11, unit: 'rafter' },
            { label: 'Estimated crew time', value: 158.55, unit: 'min' },
          ],
          assumptions: ['Time includes the package-owned pitch loading.'],
        },
      }],
    }],
    ...overrides,
  };
}

function materialsWithTwoGroups(): TrustedMaterialsBreakdownV1 {
  const base = materials();
  return {
    ...base,
    row_count: 2,
    groups: [
      ...base.groups,
      {
        id: 'drainage',
        label: 'Drainage',
        rows: [{
          instance_id: 'm1.downpipe#2',
          id: 'm1.downpipe',
          label: 'Downpipe',
          owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
          quantity: 1,
          unit: 'each',
          internal_cost_ex_gst: 45,
          explanation: {
            version: 1,
            source: '@sp/costing/materials-v1',
            summary: 'One downpipe is included for the selected gutter layout.',
            facts: [{ label: 'Downpipes', value: 1, unit: 'each' }],
            assumptions: [],
          },
        }],
      },
    ],
  };
}

function labourWithTwoGroups(): TrustedLabourBreakdownV1 {
  const base = labour();
  return {
    ...base,
    action_count: 2,
    total_crew_minutes: 188.55,
    total_crew_hours: 3.14,
    groups: [
      ...base.groups,
      {
        id: 'drainage',
        label: 'Drainage',
        crew_minutes: 30,
        crew_hours: 0.5,
        rows: [{
          instance_id: 'm1.downpipe.install#2',
          id: 'm1.downpipe.install',
          label: 'Install downpipe',
          owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
          quantity: 1,
          unit: 'each',
          minutes: 30,
          crew_hours: 0.5,
          internal_cost_ex_gst: 37.5,
          relevant_multipliers: [],
          explanation: {
            version: 1,
            source: '@sp/costing/install-actions-v1',
            summary: 'The downpipe count sets this activity.',
            facts: [{ label: 'Activity quantity', value: 1, unit: 'each' }],
            assumptions: [],
          },
        }],
      },
    ],
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Calculator trusted breakdowns', () => {
  it('shows grouped material ownership and package facts without exposing staff costs', () => {
    renderIntoDocument(
      <CalculatorMaterialsBreakdown
        breakdown={materials()}
        canViewInternalCosts={false}
        materialsExGst={839.06}
        resultFreshness="current"
      />,
    );

    expect(document.body.textContent).toContain('Structure & framing');
    expect(document.body.textContent).toContain('Pergola 1 / Module 1');
    expect(document.body.textContent).toContain('11');
    expect(document.body.textContent).toContain('bar');
    expect(document.querySelector('[data-internal-material-cost]')).toBeNull();
    expect(document.body.textContent).not.toContain('$839.06');

    const why = Array.from(document.querySelectorAll<HTMLDetailsElement>('details')).find(
      (details) => details.querySelector(':scope > summary')?.textContent === 'Why this quantity?',
    );
    expect(why?.open).toBe(false);
    act(() => why?.querySelector('summary')?.click());
    expect(why?.open).toBe(true);
    expect(document.body.textContent).toContain('Allocated waste');
    expect(document.body.textContent).toContain('12.43 m');

    const technicalSource = why?.querySelector<HTMLDetailsElement>('[data-technical-source]');
    expect(technicalSource?.open).toBe(false);
    expect(technicalSource?.querySelector('summary')?.textContent).toBe('Technical source');
    expect(technicalSource?.textContent).toContain('@sp/costing/materials-v1');
    act(() => technicalSource?.querySelector('summary')?.click());
    expect(technicalSource?.open).toBe(true);
  });

  it('opens only the first material group and preserves staff toggles across result rerenders', () => {
    const rendered = renderIntoDocument(
      <CalculatorMaterialsBreakdown
        breakdown={materialsWithTwoGroups()}
        canViewInternalCosts={false}
        materialsExGst={884.06}
        resultFreshness="current"
      />,
    );

    const groups = Array.from(
      document.querySelectorAll<HTMLDetailsElement>('[data-material-breakdown-group]'),
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]?.open).toBe(true);
    expect(groups[1]?.open).toBe(false);
    expect(groups[0]?.querySelector('[data-breakdown-group-summary]')?.textContent).toContain(
      'Structure & framing',
    );
    expect(groups[0]?.querySelector('[data-breakdown-group-summary]')?.textContent).toContain(
      '1 line',
    );
    expect(groups[1]?.querySelector('[data-breakdown-group-summary]')?.textContent).toContain(
      'Drainage',
    );

    act(() => groups[0]?.querySelector('summary')?.click());
    act(() => groups[1]?.querySelector('summary')?.click());
    expect(groups[0]?.open).toBe(false);
    expect(groups[1]?.open).toBe(true);
    expect(document.querySelectorAll('[data-material-breakdown-row]')).toHaveLength(2);

    act(() => rendered.rerender(
      <CalculatorMaterialsBreakdown
        breakdown={materialsWithTwoGroups()}
        canViewInternalCosts={false}
        materialsExGst={884.06}
        resultFreshness="invalid"
      />,
    ));

    const rerenderedGroups = Array.from(
      document.querySelectorAll<HTMLDetailsElement>('[data-material-breakdown-group]'),
    );
    expect(rerenderedGroups[0]?.open).toBe(false);
    expect(rerenderedGroups[1]?.open).toBe(true);
    expect(document.body.textContent).toContain('may not match unsaved edits');
  });

  it('shows internal material costs only when the existing permission allows them', () => {
    renderIntoDocument(
      <CalculatorMaterialsBreakdown
        breakdown={materials()}
        canViewInternalCosts
        materialsExGst={839.06}
        resultFreshness="current"
      />,
    );

    expect(document.querySelector('[data-internal-material-cost]')?.textContent).toContain(
      '$839.06',
    );
    expect(document.body.textContent).toContain('Total materials, ex GST');
  });

  it('shows labour quantities, time and only relevant package loadings', () => {
    renderIntoDocument(
      <CalculatorLabourBreakdown
        breakdown={labour()}
        canViewInternalCosts
        resultFreshness="current"
      />,
    );

    expect(document.body.textContent).toContain('Roof installation');
    expect(document.body.textContent).toContain('11');
    expect(document.body.textContent).toContain('rafter');
    expect(document.body.textContent).toContain('159 min');
    expect(document.body.textContent).toContain('2.64 crew hr');
    expect(document.body.textContent).toContain('Steep roof pitch 1.30x');
    expect(document.querySelector('[data-internal-labour-cost]')?.textContent).toContain(
      '$198.19',
    );
  });

  it('summarises labour groups by activity count and crew hours', () => {
    renderIntoDocument(
      <CalculatorLabourBreakdown
        breakdown={labourWithTwoGroups()}
        canViewInternalCosts
        resultFreshness="current"
      />,
    );

    const groups = Array.from(
      document.querySelectorAll<HTMLDetailsElement>('[data-labour-breakdown-group]'),
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]?.open).toBe(true);
    expect(groups[1]?.open).toBe(false);
    expect(groups[0]?.querySelector('[data-breakdown-group-summary]')?.textContent).toContain(
      '1 activity · 2.64 crew hr',
    );
    expect(groups[1]?.querySelector('[data-breakdown-group-summary]')?.textContent).toContain(
      '1 activity · 0.50 crew hr',
    );
  });

  it('labels retained and pre-contract results without implying current explanations', () => {
    const rendered = renderIntoDocument(
      <CalculatorMaterialsBreakdown
        breakdown={materials()}
        canViewInternalCosts={false}
        materialsExGst={undefined}
        resultFreshness="invalid"
      />,
    );
    expect(document.body.textContent).toContain('Last valid result');
    expect(document.body.textContent).toContain('may not match unsaved edits');

    act(() => rendered.rerender(
      <CalculatorMaterialsBreakdown
        breakdown={null}
        canViewInternalCosts={false}
        materialsExGst={undefined}
        resultFreshness="current"
      />,
    ));
    expect(document.body.textContent).toContain('predates the trusted material breakdown');
    expect(document.querySelector('[data-material-breakdown-row]')).toBeNull();
  });
});
