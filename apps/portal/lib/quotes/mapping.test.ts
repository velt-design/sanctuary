import { describe, expect, it } from 'vitest';
import { assertQuoteEstimateMappingReady, buildQuoteLineItemsFromEstimate } from './mapping';
import { calculateStaffCustomerPriceFromCostEx } from './pricing';

function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    roofPitchDeg: '',
    postCount: '4',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    houseConnectionType: 'soffit',
    postConnectionType: 'deck_bracket',
    ...overrides,
  };
}

function makeEstimate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'est-1',
    projectId: 'proj-1',
    createdAt: '2026-02-13T00:00:00Z',
    status: 'draft',
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Test project',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [makeModule()],
      blinds: { items: [] },
    },
    derived: {},
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: [],
    },
    configVersions: {
      pricebook: 'v',
      installActions: 'v',
      overheads: 'v',
      rules: 'v',
      manifest: 'v',
    },
    ...overrides,
  } as any;
}

describe('buildQuoteLineItemsFromEstimate', () => {
  it('creates a blind-only add-on quote without a fake pergola line', () => {
    const estimate = makeEstimate({
      inputs: {
        ...makeEstimate().inputs,
        pergolas: [],
        modules: [],
        blinds: {
          items: [{
            id: 'blind-only',
            label: 'Existing pergola blind',
            system: 'ZIPTRAK',
            widthMm: '2000',
            coverLengthMm: '2400',
            fabric: 'MESH',
            motorised: 'NONE',
            rollCover: 'NONE',
          }],
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toContain('Existing pergola blind');
    expect(result.items[0]?.description).not.toContain('Pergola works');
    expect(result.coreTotalIncCents).toBe(0);
  });

  it('creates an existing-pergola infill line without a fake pergola line', () => {
    const estimate = makeEstimate({
      inputs: {
        ...makeEstimate().inputs,
        pergolas: [],
        modules: [],
        standaloneInfills: {
          extrusionColour: 'White',
          items: [{
            id: 'wall', label: 'Side wall', qty: '1', location: 'wall',
            shape: { type: 'rect', widthM: '2.4', heightM: '1.2' },
          }],
        },
      },
      outputs: {
        ...makeEstimate().outputs,
        standalone_infills: { totals: { cost_ex_gst: 100 } },
        shared: { totals: { cost_ex_gst: 0 } },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toContain('Custom infills for existing pergola');
    expect(result.items[0]?.description).toContain('Side wall: 2.4m × 1.2m');
    expect(result.items[0]?.description).not.toContain('Pergola works');
    expect(result.coreTotalIncCents).toBe(14_375);
  });

  it('keeps additional aluminium and site costs as separate zero-pergola quote lines', () => {
    const estimate = makeEstimate({
      inputs: {
        ...makeEstimate().inputs,
        pergolas: [],
        modules: [],
        travelExGst: '50',
        additionalAluminium: {
          extrusionColour: 'Black',
          rows: [{ id: 'extra-1', profileSku: 'POST-100', quantity: '1' }],
        },
      },
      outputs: {
        ...makeEstimate().outputs,
        additional_aluminium: { item_count: 1, totals: { cost_ex_gst: 100 } },
        siteShared: { totals: { cost_ex_gst: 50 } },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);

    expect(result.items.map((item) => item.description.split('\n')[0])).toEqual([
      'Additional aluminium — supply only',
      'Project travel and site allowance',
    ]);
    expect(result.blockingIssues).toEqual([]);
  });

  it('blocks quote handoff when an empty estimate has no priced items', () => {
    const estimate = makeEstimate({
      inputs: { ...makeEstimate().inputs, pergolas: [], modules: [] },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);

    expect(result.items).toEqual([]);
    expect(result.blockingIssues).toEqual([{
      code: 'NO_PRICED_ITEMS',
      message: 'Add at least one priced item before creating a quote from this estimate.',
    }]);
  });

  it('adds a frozen engineering allowance without markup or quote discount', () => {
    const estimate = makeEstimate({
      inputs: {
        ...makeEstimate().inputs,
        quoteDiscountPct: '20',
        approvalRequirement: 'engineering_required',
      },
      outputs: {
        ...makeEstimate().outputs,
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 100 } }],
        siteShared: { totals: { cost_ex_gst: 0 } },
        customer_add_ons: {
          approval: {
            requirement: 'engineering_required',
            sell_ex_gst: 5000,
            sell_inc_gst: 5750,
          },
        },
      },
    });
    const result = buildQuoteLineItemsFromEstimate(estimate);
    const engineering = result.items.find((item) => item.description.startsWith('Project engineering allowance'));
    expect(engineering?.unitPriceIncGstCents).toBe(575_000);
    expect(engineering?.description).not.toContain('20% applied');
  });

  it('prices pergola + site snapshot lines using cost * 1.25 then GST', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Test project',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola A' },
          { id: 'pergola-2', label: 'Pergola B' },
        ],
        modules: [
          makeModule({ pergolaId: 'pergola-1', lengthM: '6', projectionM: '3' }),
          makeModule({ pergolaId: 'pergola-2', lengthM: '4', projectionM: '2.5' }),
        ],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 340, cost_inc_gst: 391, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola A', totals: { cost_ex_gst: 100 } },
          { id: 'pergola-2', label: 'Pergola B', totals: { cost_ex_gst: 200 } },
        ],
        siteShared: {
          totals: { cost_ex_gst: 40 },
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(14375);
    expect(result.items[1]?.unitPriceIncGstCents).toBe(28750);
    expect(result.items[2]?.unitPriceIncGstCents).toBe(5750);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(
      Math.round((calculateStaffCustomerPriceFromCostEx(100)?.incGst ?? 0) * 100),
    );
    expect(result.items[2]?.description).toContain('Project-specific delivery, setup and site costs');
    expect(result.coreTotalIncCents).toBe(48875);
  });

  it('folds shared site costs into pergola when only one pergola exists', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Single pergola',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({ pergolaId: 'pergola-1' })],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 140, cost_inc_gst: 161, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 100 } }],
        siteShared: {
          totals: { cost_ex_gst: 40 },
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toContain('Pergola 1');
    expect(result.items[0]?.description).not.toContain('Site costs');
    expect(result.items[0]?.description).toContain('Project delivery: Project-specific setup and site costs included in this item');
    expect(result.items[0]?.unitPriceIncGstCents).toBe(20125);
    expect(result.coreTotalIncCents).toBe(20125);
  });

  it('uses the frozen customer-price multiplier when handing an estimate to a quote', () => {
    const estimate = makeEstimate({
      outputs: {
        ...makeEstimate().outputs,
        pricing_policy: {
          requested_classification: 'simple',
          resolved_classification: 'simple',
          simple_eligible: true,
          reason_codes: [],
          customer_price_multiplier: 1.3,
          customer_price_uplift_pct: 0,
        },
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 100 } }],
        siteShared: { totals: { cost_ex_gst: 0 } },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(14_950);
  });

  it('keeps configured infills visible inside their owning pergola quote line', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Infill attribution',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({
          infills: {
            items: [{ id: 'infill-1', label: 'Front infill' }],
          },
        })],
        blinds: { items: [] },
      },
      outputs: {
        cost_snapshot_version: 'v2',
        pergolas: [{
          id: 'pergola-1',
          label: 'Pergola 1',
          totals: { cost_ex_gst: 100 },
          infill_cost_breakdown: {
            schema_version: 'infill_cost_breakdown_v1',
            status: 'ready',
            items: [{
              module_id: 'pergola-1.module-1',
              infill_id: 'infill-1',
              total_ex_gst: 20,
            }],
            remainder: { total_ex_gst: 80 },
          },
        }],
        siteShared: { totals: { cost_ex_gst: 0 } },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(14375);
    expect(result.items[0]?.description).toContain('Pergola 1');
    expect(result.items[0]?.description).toContain('Included infills');
    expect(result.items[0]?.description).toContain('Front infill');
  });

  it('applies a non-zero quote discount to pergola and shared site lines', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Discounted site',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '10',
        pergolas: [
          { id: 'pergola-1', label: 'Front patio' },
          { id: 'pergola-2', label: 'Pool cover' },
        ],
        modules: [
          makeModule({ pergolaId: 'pergola-1' }),
          makeModule({ pergolaId: 'pergola-2' }),
        ],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 240, cost_inc_gst: 276, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [
          { id: 'pergola-1', label: 'Front patio', totals: { cost_ex_gst: 100 } },
          { id: 'pergola-2', label: 'Pool cover', totals: { cost_ex_gst: 100 } },
        ],
        siteShared: { totals: { cost_ex_gst: 40 } },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items.map((item) => item.unitPriceIncGstCents)).toEqual([12938, 12938, 5175]);
    expect(result.items.every((item) => item.description.includes('Quote discount: 10% included in this item'))).toBe(true);
    expect(result.coreTotalIncCents).toBe(31051);
  });

  it('blocks invalid blinds instead of creating a zero-priced quote line', () => {
    const base = makeEstimate();
    const estimate = makeEstimate({
      inputs: {
        ...(base as any).inputs,
        blinds: {
          items: [
            {
              id: 'blind-1',
              label: 'Pool blind',
              system: 'ZIPTRAK',
              widthMm: '',
              coverLengthMm: '',
              fabric: 'MESH',
              motorised: 'NONE',
              rollCover: 'FLASHING',
            },
          ],
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items.some((item) => item.description.includes('Pool blind'))).toBe(false);
    expect(result.blockingIssues).toEqual([
      {
        code: 'INVALID_BLIND',
        message: 'Pool blind needs valid dimensions and selections before a quote can be created.',
      },
    ]);
    expect(() => assertQuoteEstimateMappingReady(result)).toThrow(
      'Quote handoff blocked: Pool blind needs valid dimensions and selections before a quote can be created.',
    );
  });

  it('prices one non-discountable structured lighting line per pergola', () => {
    const base = makeEstimate();
    const estimate = makeEstimate({
      inputs: {
        ...(base as any).inputs,
        quoteDiscountPct: '20',
        pergolas: [{
          id: 'pergola-1',
          label: 'Courtyard',
          lighting: { lightCount: '17', dimmer: false },
        }],
      },
      outputs: {
        ...(base as any).outputs,
        lighting_total_inc_gst: 999,
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);
    const lighting = result.items.find((item) => item.description.startsWith('Courtyard integrated rafter lighting'));
    expect(lighting?.unitPriceIncGstCents).toBe(453_000);
    expect(lighting?.description).toContain('17 rafter lights');
    expect(lighting?.description).toContain('Drivers: 2');
    expect(lighting?.description).not.toContain('20% applied');
    expect(result.items.some((item) => item.unitPriceIncGstCents === 99_900)).toBe(false);
  });

  it('blocks configured lighting when its pergola has no acrylic module', () => {
    const base = makeEstimate();
    const estimate = makeEstimate({
      inputs: {
        ...(base as any).inputs,
        pergolas: [{
          id: 'pergola-1',
          label: 'Timber patio',
          lighting: { lightCount: '4', dimmer: true },
        }],
        modules: [makeModule({ roofMaterial: 'timber' })],
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate);
    expect(result.blockingIssues).toMatchObject([{
      code: 'INVALID_LIGHTING',
      message: expect.stringContaining('available only for acrylic pergolas'),
    }]);
    expect(result.items.some((item) => item.description.includes('Timber patio lighting'))).toBe(false);
  });

  it('hands the corrected blind price and roll-cover detail to quote lines', () => {
    const base = makeEstimate();
    const estimate = makeEstimate({
      inputs: {
        ...(base as any).inputs,
        blinds: {
          items: [
            {
              id: 'blind-covered',
              label: 'Pool blind',
              system: 'OMNI',
              widthMm: '2000',
              coverLengthMm: '2000',
              fabric: 'MESH',
              motorised: 'NONE',
              rollCover: 'FLASHING',
            },
          ],
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    const blindLine = result.items.find((item) => item.description.includes('Pool blind'));

    expect(blindLine?.unitPriceIncGstCents).toBe(187050);
    expect(blindLine?.description).toContain('Roll cover: Flashing — 2m charged at $44/m; $88.00 incl GST');
    expect(result.blockingIssues).toEqual([]);
  });

  it('falls back to one legacy line item and includes a warning note', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Legacy project',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        modules: [makeModule(), makeModule({ lengthM: '4' })],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 300, cost_inc_gst: 345, warnings: [], notes_and_warnings: [] },
        warnings: [],
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(43125);
    expect(result.items[0]?.description).toContain('Included: Custom-designed pergola, supplied and installed');
    expect(result.items[0]?.description).not.toContain('Legacy estimate');
    expect(result.items[0]?.description).not.toContain('Regenerate estimate');
    expect(result.coreTotalIncCents).toBe(43125);
  });

  it('groups shared and module-specific details for mixed pergolas', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Mixed pergola',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [
          makeModule({ pergolaId: 'pergola-1', pergolaStyle: 'gable', roofPitchDeg: '25', postCount: '4' }),
          makeModule({
            pergolaId: 'pergola-1',
            pergolaStyle: 'perimeter',
            lengthM: '4.2',
            projectionM: '2.6',
            roofPitchDeg: '25',
            postCount: '3',
          }),
        ],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 240, cost_inc_gst: 276, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 240 } }],
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description.startsWith('Pergola 1')).toBe(true);
    expect(result.items[0]?.description).toContain('Included: Custom-designed pergola, supplied and installed');
    expect(result.items[0]?.description).toContain('Configuration: Gable + Perimeter roof sections');
    expect(result.items[0]?.description).toContain('Shared across all roof sections');
    expect(result.items[0]?.description).toContain('Roof covering: Acrylic roofing — admits natural light while adding overhead shelter');
    expect(result.items[0]?.description).toContain('Frame finish: Black');
    expect(result.items[0]?.description).toContain('Roof section 1: Gable');
    expect(result.items[0]?.description).toContain('Roof section 2: Perimeter');
    expect(result.items[0]?.description).toContain('Overall size: 6m x 3m');
    expect(result.items[0]?.description).toContain('Overall size: 4.2m x 2.6m');
    expect(result.items[0]?.description).toContain('Roof pitch: 25°');
    expect(result.items[0]?.description).toContain('Support posts: 4');
    expect(result.items[0]?.description).toContain('Support posts: 3');
    expect(result.items[0]?.description?.match(/Roof covering:/g)).toHaveLength(1);
    expect(result.items[0]?.description?.match(/Frame finish: Black/g)).toHaveLength(1);
  });
});
