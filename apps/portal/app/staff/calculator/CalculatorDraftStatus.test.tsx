import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CalculatorDraftStatus from './CalculatorDraftStatus';
import type { CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

function renderStatus(status: CalculatorLocalDraftStatus): string {
  return renderToStaticMarkup(<CalculatorDraftStatus status={status} />);
}

describe('CalculatorDraftStatus', () => {
  it.each([
    [{ kind: 'saving' }, 'Saving locally'],
    [{ kind: 'saved' }, 'Saved locally'],
    [{ kind: 'restored', source: 'working-copy' }, 'Restored unsaved work'],
    [{ kind: 'error' }, 'Local save failed'],
  ] satisfies Array<[CalculatorLocalDraftStatus, string]>)('renders %s with browser-only guidance', (status, label) => {
    const markup = renderStatus(status);
    expect(markup).toContain(label);
    expect(markup).toContain('Browser draft only — use Save to update the estimate.');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
  });

  it('does not render the internal idle state', () => {
    expect(renderStatus({ kind: 'idle' })).toBe('');
  });
});
