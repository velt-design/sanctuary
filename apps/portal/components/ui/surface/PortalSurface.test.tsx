import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState, InlineNotice, PortalSection, StatusPill, TableShell } from './PortalSurface';
import { renderIntoDocument } from '../../../../../test/reactHarness';

describe('PortalSurface primitives', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the shared section shell', () => {
    const rendered = renderIntoDocument(
      <PortalSection title="Summary" meta={<span>Meta</span>} actions={<button type="button">Action</button>} ariaLabel="Summary section">
        <div>Section body</div>
      </PortalSection>,
    );

    const section = rendered.container.querySelector('section[aria-label="Summary section"]');
    expect(section?.textContent).toContain('Summary');
    expect(section?.textContent).toContain('Meta');
    expect(section?.textContent).toContain('Action');
    expect(section?.textContent).toContain('Section body');

    rendered.unmount();
  });

  it('renders notices, status pills, empty states, and table shells', () => {
    const rendered = renderIntoDocument(
      <div>
        <InlineNotice tone="error">Something went wrong.</InlineNotice>
        <StatusPill tone="paid">Paid</StatusPill>
        <EmptyState title="No contacts" description="Add a contact to get started." actions={<button type="button">New Contact</button>} />
        <TableShell>
          <table>
            <tbody>
              <tr>
                <td>Row</td>
              </tr>
            </tbody>
          </table>
        </TableShell>
      </div>,
    );

    expect(rendered.container.textContent).toContain('Something went wrong.');
    expect(rendered.container.textContent).toContain('Paid');
    expect(rendered.container.textContent).toContain('No contacts');
    expect(rendered.container.textContent).toContain('Add a contact to get started.');
    expect(rendered.container.textContent).toContain('New Contact');
    expect(rendered.container.textContent).toContain('Row');

    rendered.unmount();
  });
});
