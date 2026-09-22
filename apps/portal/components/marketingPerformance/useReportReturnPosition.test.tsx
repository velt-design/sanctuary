import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import useReportReturnPosition from './useReportReturnPosition';

function Report({ busy }: { busy: boolean }) {
  const position = useReportReturnPosition(busy);
  return <div ref={position.region} style={{ minHeight: position.height }} onClickCapture={position.remember}>{busy ? 'Loading' : 'Evidence'}</div>;
}
afterEach(() => { window.sessionStorage.clear(); vi.restoreAllMocks(); });

it('reserves the previous report footprint and restores the evidence position through loading', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.sessionStorage.setItem(`marketing-report-position:${window.location.pathname}${window.location.search}`, JSON.stringify({ height: 3200, y: 2370 }));
  const rendered = renderIntoDocument(<Report busy />);
  expect(rendered.container.firstElementChild?.getAttribute('style')).toContain('3200px');
  expect(scroll).toHaveBeenCalledWith({ top: 2370, behavior: 'instant' });
  rendered.rerender(<Report busy={false} />);
  expect(scroll).toHaveBeenCalledWith({ top: 2370, behavior: 'instant' });
  const callsAfterReturn = scroll.mock.calls.length;
  rendered.rerender(<Report busy />);
  rendered.rerender(<Report busy={false} />);
  expect(scroll).toHaveBeenCalledTimes(callsAfterReturn);
  rendered.unmount();
});

it('ignores corrupt optional browser state without preventing the report', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.sessionStorage.setItem(`marketing-report-position:${window.location.pathname}${window.location.search}`, '{broken');
  const rendered = renderIntoDocument(<Report busy={false} />);
  expect(rendered.container.textContent).toBe('Evidence');
  expect(scroll).not.toHaveBeenCalled();
  rendered.unmount();
});
