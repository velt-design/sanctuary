import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectNote } from '@/lib/projects/types';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectNotesPanel from './ProjectNotesPanel.client';

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({
    email: 'ellen@example.test',
    isAdmin: false,
    user: { id: 'user_1' },
  }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: vi.fn(),
}));

const notes: ProjectNote[] = [
  {
    id: 'note_1',
    body: 'Measured the existing slab and confirmed access is clear.',
    authorId: 'user_1',
    authorEmail: 'info@sanctuarypergolas.co.nz',
    authorDisplayName: 'Ellen',
    createdAt: '2026-05-31T22:30:00.000Z',
    updatedAt: '2026-05-31T22:30:00.000Z',
    isOwn: false,
  },
];

function renderPanel() {
  const queryClient = new QueryClient();
  return renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ProjectNotesPanel projectId="proj_1" initialNotes={notes} />
    </QueryClientProvider>,
  );
}

describe('ProjectNotesPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders project-note activity cards with label, note body, and author metadata', () => {
    const rendered = renderPanel();

    const note = rendered.container.querySelector('[data-project-note-id="note_1"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('Project note');
    expect(note?.textContent).toContain('Measured the existing slab and confirmed access is clear.');
    expect(note?.textContent).toContain('Added by Ellen');

    const label = note!.querySelector('span');
    const body = note!.querySelector('p');
    expect(label?.textContent).toBe('Project note');
    expect(body?.textContent).toContain('Measured the existing slab');
    expect(label!.compareDocumentPosition(body!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rendered.unmount();
  });
});
