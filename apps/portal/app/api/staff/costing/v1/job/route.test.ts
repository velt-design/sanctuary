import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffContext = vi.fn();
const resolvePublishedCostingConfiguration = vi.fn();
const calculateSiteCostV1 = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext }));
vi.mock('@/lib/costing/configurationResolver', () => ({ resolvePublishedCostingConfiguration }));
vi.mock('@sp/costing', () => ({ calculateSiteCostV1 }));

describe('POST /api/staff/costing/v1/job', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffContext.mockReset();
    resolvePublishedCostingConfiguration.mockReset();
    calculateSiteCostV1.mockReset();
  });

  it('reuses the authorized client and exposes private server-stage timings', async () => {
    const supabase = { from: vi.fn() };
    const config = { version: 'published' };
    const provenance = { schemaVersion: 'costing-provenance.v1', source: 'published' };
    requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: 'user-1' }, role: 'staff' },
      supabase,
    });
    resolvePublishedCostingConfiguration.mockResolvedValue({ config, provenance });
    calculateSiteCostV1.mockReturnValue({ totals: { cost_ex_gst: 100 } });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/costing/v1/job', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modules: [{
          length_m: 6,
          roof_span_m: 4,
          pergola_style: 'pitched',
          roof_material: 'acrylic',
          extrusion_colour: 'White',
          house_connection_type: 'fascia',
          post_connection_type: 'slab_anchors',
          access: 'normal',
          height: 'single_storey',
        }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toEqual(expect.stringContaining('auth;dur='));
    expect(response.headers.get('server-timing')).toEqual(expect.stringContaining('config;dur='));
    expect(response.headers.get('server-timing')).toEqual(expect.stringContaining('calculate;dur='));
    expect(response.headers.get('server-timing')).toEqual(expect.stringContaining('serialize;dur='));
    expect(resolvePublishedCostingConfiguration).toHaveBeenCalledWith(supabase);
    expect(calculateSiteCostV1).toHaveBeenCalledWith(
      expect.objectContaining({ pergolas: [expect.objectContaining({ modules: [expect.any(Object)] })] }),
      config,
    );
    await expect(response.json()).resolves.toEqual({
      totals: { cost_ex_gst: 100 },
      costingConfiguration: provenance,
    });
  });
});
