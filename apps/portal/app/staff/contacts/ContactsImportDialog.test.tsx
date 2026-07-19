import { act } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsImportDialog from './ContactsImportDialog';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const apiJson = vi.fn();
const parseContactsCsv = vi.fn();
const planContactsImport = vi.fn();
const upsertContactCaches = vi.fn();
const invalidateContactsIndexCaches = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const onClose = vi.fn();
const queryClient = {};
const file = { name: 'contacts.csv', text: vi.fn().mockResolvedValue('name,email,phone') } as unknown as File;

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
}));
vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ error: toastError, success: toastSuccess }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queryClient }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: (...args: unknown[]) => apiJson(...args) }));
vi.mock('@/lib/import/contactsCsv', () => ({
  parseContactsCsv: (...args: unknown[]) => parseContactsCsv(...args),
  planContactsImport: (...args: unknown[]) => planContactsImport(...args),
}));
vi.mock('@/lib/localFirst/portalEntities', () => ({
  upsertContactCaches: (...args: unknown[]) => upsertContactCaches(...args),
}));
vi.mock('@/lib/queries/contactsIndex', () => ({
  invalidateContactsIndexCaches: (...args: unknown[]) => invalidateContactsIndexCaches(...args),
}));

describe('ContactsImportDialog', () => {
  beforeEach(() => {
    apiJson.mockReset();
    parseContactsCsv.mockReset();
    planContactsImport.mockReset();
    upsertContactCaches.mockReset();
    invalidateContactsIndexCaches.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    onClose.mockReset();
    parseContactsCsv.mockReturnValue({ headerRowNumber: 1, warnings: [], rows: [{ sourceRowNumber: 2, displayName: 'New Contact', email: 'new@example.com', phone: '022' }] });
    planContactsImport.mockReturnValue({
      stats: { create: 1, merge: 0, skip: 0, invalid: 0 },
      decisions: [{ action: 'create', row: { sourceRowNumber: 2, displayName: 'New Contact', email: 'new@example.com', phone: '022' } }],
    });
    apiJson.mockResolvedValue({ contact: { id: 'ct_2', displayName: 'New Contact', email: 'new@example.com', phone: '022' } });
    invalidateContactsIndexCaches.mockResolvedValue(undefined);
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps the lazy import workflow cache-coherent after a successful create', async () => {
    const rendered = renderIntoDocument(<ContactsImportDialog file={file} contacts={[]} host="host" onClose={onClose} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const confirm = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Confirm import');
    await act(async () => { confirm?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(apiJson).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({ method: 'POST' }));
    expect(upsertContactCaches).toHaveBeenCalledWith(queryClient, 'host', expect.objectContaining({ id: 'ct_2' }));
    expect(invalidateContactsIndexCaches).toHaveBeenCalledWith(queryClient, 'host');
    expect(toastSuccess).toHaveBeenCalledWith('Imported contacts: 1 created, 0 merged.');
    expect(onClose).toHaveBeenCalled();
    rendered.unmount();
  });

  it('keeps the dialog open and reports an import failure', async () => {
    apiJson.mockRejectedValueOnce(new Error('Import exploded'));
    const rendered = renderIntoDocument(<ContactsImportDialog file={file} contacts={[]} host="host" onClose={onClose} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const confirm = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Confirm import');
    await act(async () => { confirm?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(rendered.container.textContent).toContain('Import exploded');
    expect(toastError).toHaveBeenCalledWith('Import exploded');
    expect(onClose).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
