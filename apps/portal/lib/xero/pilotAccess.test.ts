import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), grant: vi.fn() }));
vi.mock('../auth', () => ({ getPortalSession: mocks.session }));
vi.mock('../invoices/xeroMatchRepository', () => ({ hasPaymentApprovalGrant: mocks.grant }));
import { getPaymentPilotSession } from './pilotAccess';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('XERO_PAYMENT_MATCHING_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
describe('finance session capability', () => {
  it.each(['ellen', 'jordan'])('allows confirmed %s only while the database grant remains active', async name => {
    const session = { user: { id: name, email: `${name}@sanctuarypergolas.co.nz`, email_confirmed_at: 'today' }, role: 'admin' };
    mocks.session.mockResolvedValue(session); mocks.grant.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await getPaymentPilotSession()).toEqual(session);
    expect(await getPaymentPilotSession()).toBeNull();
    expect(mocks.grant).toHaveBeenCalledWith(name);
  });
  it('denies ordinary admins without a finance grant', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'admin', email: 'info@sanctuarypergolas.co.nz', email_confirmed_at: 'today' }, role: 'admin' });
    mocks.grant.mockResolvedValue(false);
    expect(await getPaymentPilotSession()).toBeNull();
  });
  it('denies unconfirmed, disabled and failed grant lookups', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'ellen', email: 'ellen@sanctuarypergolas.co.nz' } });
    expect(await getPaymentPilotSession()).toBeNull(); expect(mocks.grant).not.toHaveBeenCalled();
    vi.stubEnv('XERO_PAYMENT_MATCHING_ENABLED', 'false');
    expect(await getPaymentPilotSession()).toBeNull();
    vi.stubEnv('XERO_PAYMENT_MATCHING_ENABLED', 'true');
    mocks.session.mockResolvedValue({ user: { id: 'ellen', email: 'ellen@sanctuarypergolas.co.nz', email_confirmed_at: 'today' } });
    mocks.grant.mockRejectedValue(new Error('PAYMENT_REVIEW_UNAVAILABLE'));
    await expect(getPaymentPilotSession()).rejects.toThrow('PAYMENT_REVIEW_UNAVAILABLE');
  });
});
