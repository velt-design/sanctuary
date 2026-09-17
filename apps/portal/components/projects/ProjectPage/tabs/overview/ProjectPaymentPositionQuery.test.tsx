import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectPaymentPositionQuery from './ProjectPaymentPositionQuery';

const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.value }));
vi.mock('./ProjectPaymentPosition', () => ({ default: () => <div>Saved private payment</div> }));
afterEach(() => { document.body.innerHTML = ''; });

describe('ProjectPaymentPositionQuery', () => {
  it.each([401, 403, 404])('hides cached money when access ends with %s', (status) => {
    state.value = { data: {}, isError: true, error: new ApiError('Access ended', { status, body: null }) };
    const onAccessEnding = vi.fn();
    const view = renderIntoDocument(<ProjectPaymentPositionQuery projectId="proj_1" host="fixture" onAccessEnding={onAccessEnding} />);
    expect(view.container.textContent).not.toContain('Saved private payment');
    expect(view.container.textContent).toContain('Payment access unavailable');
    expect(onAccessEnding).toHaveBeenCalledWith(status);
    view.unmount();
  });
  it('shows missing payments as unavailable rather than zero', () => {
    state.value = { isError: true, error: new Error('Offline'), refetch: vi.fn() };
    const view = renderIntoDocument(<ProjectPaymentPositionQuery projectId="proj_1" host="fixture" />);
    expect(view.container.textContent).toContain('Payments unavailable');
    expect(view.container.textContent).not.toContain('$0');
    view.unmount();
  });
});
