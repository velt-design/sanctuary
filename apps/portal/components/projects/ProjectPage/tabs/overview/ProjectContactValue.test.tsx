import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectContactValue from './ProjectContactValue';

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('customer contact read actions', () => {
  it('copies the displayed phone and reports clipboard failure truthfully', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const rendered = renderIntoDocument(<ProjectContactValue label="Phone" value="021 000 0000" href="tel:0210000000" />);
    expect(rendered.container.querySelector('a')?.getAttribute('href')).toBe('tel:0210000000');
    await act(async () => { rendered.container.querySelector('button')?.click(); });
    expect(writeText).toHaveBeenCalledWith('021 000 0000');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toBe('Copied');
    await act(async () => { rendered.container.querySelector('button')?.click(); });
    expect(rendered.container.textContent).toContain('Could not copy');
    rendered.unmount();
  });

  it('shows missing information without a broken link or copy action', () => {
    const rendered = renderIntoDocument(<ProjectContactValue label="Phone" value="" />);
    expect(rendered.container.textContent).toBe('Phone not provided');
    expect(rendered.container.querySelector('a, button')).toBeNull();
    rendered.unmount();
  });
});
