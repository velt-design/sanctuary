import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCostingConfigV1 } from '@sp/costing';

const requireStaffSession = vi.fn();
const resolvePublishedCostingConfiguration = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({ requireStaffSession }));
vi.mock('@/lib/costing/configurationResolver', () => ({ resolvePublishedCostingConfiguration }));

describe('GET /api/staff/costing/v1/aluminium-catalogue', () => {
  beforeEach(() => {
    requireStaffSession.mockReset();
    resolvePublishedCostingConfiguration.mockReset();
  });

  it('requires staff authentication', async () => {
    requireStaffSession.mockResolvedValue(null);
    const { GET } = await import('./route');

    expect((await GET()).status).toBe(401);
    expect(resolvePublishedCostingConfiguration).not.toHaveBeenCalled();
  });

  it('returns profile and length choices without material costs', async () => {
    requireStaffSession.mockResolvedValue({ user: { id: 'staff-1' } });
    resolvePublishedCostingConfiguration.mockResolvedValue({
      config: loadCostingConfigV1(),
      provenance: { source: 'published', versionNumber: 4 },
    });
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ profile: '150x50', stockLengthsM: [4, 5, 6] }),
    ]));
    expect(JSON.stringify(body.items)).not.toContain('cost_ex_gst');
  });
});
