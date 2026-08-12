import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCostingConfigV1 } from '@sp/costing';

const getPortalSession = vi.fn();
const resolvePublishedCostingConfiguration = vi.fn();

vi.mock('@/lib/auth', () => ({ getPortalSession }));
vi.mock('@/lib/costing/configurationResolver', () => ({ resolvePublishedCostingConfiguration }));

describe('POST /api/staff/costing/v1/job', () => {
  beforeEach(() => {
    getPortalSession.mockReset();
    resolvePublishedCostingConfiguration.mockReset();
    getPortalSession.mockResolvedValue({ user: { id: 'staff-1' } });
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: loadCostingConfigV1(),
      provenance: { source: 'published', versionNumber: 1 },
    });
  });

  it('accepts an empty pergola array for a blank add-on estimate', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/costing/v1/job', {
      method: 'POST',
      body: JSON.stringify({ pergolas: [], pricing_classification: 'bespoke' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ pergola_count: 0, pergolas: [] });
  });

  it('accepts standalone infills without pergola geometry', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/staff/costing/v1/job', {
      method: 'POST',
      body: JSON.stringify({
        pergolas: [],
        pricing_classification: 'bespoke',
        standalone_infills: {
          extrusion_colour: 'Black',
          access: 'normal',
          height: 'single_storey',
          infills: [{
            id: 'existing-wall',
            qty: 1,
            location: 'wall',
            acrylic_source: 'sheet_panels',
            panel_orientation: 'vertical',
            width_mode: 'target_width',
            target_panel_width_m: 1.2,
            max_panel_width_m: 1.2,
            support: { has_top: true, has_bottom: true, has_left: true, has_right: true, internal_support_mode: 'none' },
            shape: { type: 'rect', width_m: 2.4, height_m: 1.2 },
          }],
        },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pergolas).toEqual([]);
    expect(body.standalone_infills).toMatchObject({ item_count: 1 });
  });
});
