import { act } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';

const setIsEditing = vi.fn();

vi.mock('../../useProjectDetailsDraft', () => ({
  useProjectDetailsDraft: () => ({
    canRetry: false,
    canSave: false,
    displayed: {
      contactName: 'Aroha Smith',
      contactEmail: 'aroha@example.test',
      contactPhone: '021 555 0100',
      projectName: 'Aroha - Takapuna',
      siteAddress: '10 Example Road, Takapuna',
      region: 'Auckland',
      quoteRef: 'Q-2042',
    },
    draft: {
      contactName: 'Aroha Smith',
      contactEmail: 'aroha@example.test',
      contactPhone: '021 555 0100',
      projectName: 'Aroha - Takapuna',
      siteAddress: '10 Example Road, Takapuna',
      region: 'Auckland',
      quoteRef: 'Q-2042',
    },
    error: null,
    finishEditing: vi.fn(),
    isEditing: false,
    isSaving: false,
    resetEditing: vi.fn(),
    retry: vi.fn(),
    reviewLocalDraft: vi.fn(),
    saveCurrentDraft: vi.fn(),
    setIsEditing,
    statusText: null,
    updateDraftField: vi.fn(),
  }),
}));

vi.mock('./ProjectStageControl', () => ({
  default: () => <div data-testid="stage-control">Contacted</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ProjectStatusDetailsCard from './ProjectStatusDetailsCard';

describe('ProjectStatusDetailsCard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    setIsEditing.mockReset();
  });

  it('keeps project facts compact and exposes direct customer and site shortcuts', async () => {
    await import('./ProjectStageControl');
    let rendered!: ReturnType<typeof renderIntoDocument>;
    await act(async () => {
      rendered = renderIntoDocument(
        <ProjectStatusDetailsCard
          host="fixture"
          project={{
            id: 'proj_fixture',
            name: 'Aroha - Takapuna',
            stage: 'contacted',
          } as any}
        />,
      );
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[aria-label="Project details"]')?.getAttribute('data-columns')).toBe('4');
    expect(rendered.container.querySelector('a[href="tel:021 555 0100"]')?.textContent).toBe('Call customer');
    expect(rendered.container.querySelector('a[href="mailto:aroha@example.test"]')?.textContent).toBe('Email customer');
    expect(rendered.container.querySelector('a[href*="google.com/maps/search/"]')?.getAttribute('target')).toBe('_blank');
    expect(rendered.container.querySelector('nav[aria-label="Customer and site shortcuts"]')).not.toBeNull();

    rendered.unmount();
  });
});
