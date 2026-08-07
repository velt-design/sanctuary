import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import DesignWorkbenchLoading from './loading';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'proj_123' }),
}));

describe('DesignWorkbenchLoading', () => {
  it('keeps the data-free workbench structure visible while the specialist route loads', () => {
    const html = renderToStaticMarkup(<DesignWorkbenchLoading />);

    expect(html).toContain('data-portal-page-shell="design-workbench"');
    expect(html).toContain('data-workbench-object-rail="true"');
    expect(html).toContain('data-workbench-workspace="true"');
    expect(html).toContain('data-workbench-inspector="true"');
    expect(html).toContain('href="/staff/projects/proj_123"');
    expect(html).not.toContain('data-portal-instant-shell');
  });
});
