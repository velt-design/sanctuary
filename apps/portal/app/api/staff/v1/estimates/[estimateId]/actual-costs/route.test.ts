import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireStaffContext,
  parseJsonBody,
  loadEstimateCostCalibration,
  parseEstimateActualCostInput,
  saveEstimateCostActuals,
} = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  parseJsonBody: vi.fn(),
  loadEstimateCostCalibration: vi.fn(),
  parseEstimateActualCostInput: vi.fn(),
  saveEstimateCostActuals: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireStaffContext,
    parseJsonBody,
    jsonError: (message: string, status = 400) => NextResponse.json({ error: message }, { status }),
    jsonOk: (payload: Record<string, unknown>, status = 200) => NextResponse.json(payload, { status }),
  };
});

vi.mock('@/lib/estimateActuals/server', () => ({
  loadEstimateCostCalibration,
  parseEstimateActualCostInput,
  saveEstimateCostActuals,
}));

import { GET, PUT } from './route';

const context = { params: Promise.resolve({ estimateId: 'est_1' }) };
const comparison = {
  estimated: { totalExGst: 100 },
  actual: null,
  variance: { totalExGst: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffContext.mockResolvedValue({
    ok: true,
    supabase: { from: vi.fn() },
    session: { user: { id: 'user-1', email: 'ops@example.com' } },
  });
});

describe('estimate actual-cost routes', () => {
  it('requires a staff context', async () => {
    requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(401);
    expect(loadEstimateCostCalibration).not.toHaveBeenCalled();
  });

  it('returns the frozen-estimate comparison', async () => {
    loadEstimateCostCalibration.mockResolvedValue({ comparison });
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ comparison });
  });

  it('rejects incomplete final actuals and saves valid drafts', async () => {
    parseJsonBody.mockResolvedValue({ ok: true, body: {} });
    parseEstimateActualCostInput.mockReturnValueOnce({
      materialsExGst: null,
      installExGst: null,
      overheadExGst: null,
      travelExGst: null,
      extrasExGst: null,
      crewHours: null,
      notes: '',
      isComplete: true,
    });
    const blocked = await PUT(new Request('http://localhost', { method: 'PUT' }), context);
    expect(blocked.status).toBe(400);
    expect(saveEstimateCostActuals).not.toHaveBeenCalled();

    const input = {
      materialsExGst: 100,
      installExGst: 50,
      overheadExGst: 20,
      travelExGst: null,
      extrasExGst: null,
      crewHours: 8,
      notes: '',
      isComplete: true,
    };
    parseEstimateActualCostInput.mockReturnValueOnce(input);
    saveEstimateCostActuals.mockResolvedValue({ comparison });
    const saved = await PUT(new Request('http://localhost', { method: 'PUT' }), context);
    expect(saved.status).toBe(200);
    expect(saveEstimateCostActuals).toHaveBeenCalledWith(expect.anything(), 'est_1', expect.objectContaining({ id: 'user-1' }), input);
  });
});
