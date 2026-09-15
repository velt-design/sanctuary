import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCostV1, loadCostingConfigV1 } from '@sp/costing';
import { makeDefaultCalculatorInputs, normalizeCalculatorInputsForUi } from '@/app/staff/calculator/calculatorInputs';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';

const { session, resolve } = vi.hoisted(() => ({ session: vi.fn(), resolve: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getPortalSession: session }));
vi.mock('@/lib/costing/configurationResolver', () => ({ resolvePublishedCostingConfiguration: resolve }));

describe('staff ceiling selection through calculation routes', () => {
  beforeEach(() => {
    session.mockResolvedValue({ user: { id: 'staff-test' } });
    resolve.mockResolvedValue({ config: loadCostingConfigV1(), provenance: { source: 'published', versionNumber: 12 } });
  });

  it.each(['thermopine-100', 'thermopine-150', 'cedar-100', 'cedar-150'] as const)(
    'preserves saved %s through the calculator adapter and HTTP costing', async option => {
      const inputs = makeDefaultCalculatorInputs();
      Object.assign(inputs.modules[0]!, { roofMaterial: 'timber', ceilingOption: option, timberRoofAboveType: 'steel_corrugated' });
      const reloaded = normalizeCalculatorInputsForUi(JSON.parse(JSON.stringify(inputs)));
      expect(reloaded.modules[0]?.ceilingOption).toBe(option);
      const site = buildSiteInputsFromCalculatorInputs(reloaded);
      const module = site.pergolas[0]!.modules[0]!;
      const expected = calculateCostV1(module, loadCostingConfigV1());
      for (const [POST, payload] of [
        [(await import('@/app/api/staff/costing/v1/job/route')).POST, site],
        [(await import('@/app/api/staff/costing/v1/route')).POST, module],
        [(await import('@/app/api/staff/costing/v1/materials-explain/route')).POST, module],
      ] as const) {
        const response = await POST(new Request('http://localhost/api/staff/costing', { method: 'POST', body: JSON.stringify(payload) }));
        const body = await response.json();
        expect(response.status, JSON.stringify(body)).toBe(200);
        const calculation = body.pergolas ? body.pergolas[0].modules[0] : body.output ?? body;
        expect(calculation.materials.lines).toEqual(expected.materials.lines);
        expect(calculation.materials.lines.some((line: { id: string }) => line.id === `ceiling.${option}_lm`)).toBe(true);
        expect(calculation.materials.lines.some((line: { id: string }) => line.id.includes('110cover'))).toBe(false);
      }
    },
  );

  it.each([{ option: 'unknown' }, null, { option: 'cedar-100', rate: 0 }])('rejects invalid ceiling %j', async ceiling => {
    const inputs = makeDefaultCalculatorInputs();
    inputs.modules[0]!.roofMaterial = 'timber';
    const site = buildSiteInputsFromCalculatorInputs(inputs);
    Object.assign(site.pergolas[0]!.modules[0]!, { ceiling });
    const { POST } = await import('@/app/api/staff/costing/v1/job/route');
    const response = await POST(new Request('http://localhost/api/staff/costing/v1/job', { method: 'POST', body: JSON.stringify(site) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('ceiling');
  });
});
