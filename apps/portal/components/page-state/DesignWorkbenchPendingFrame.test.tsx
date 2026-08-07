import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import DesignWorkbenchPendingFrame from './DesignWorkbenchPendingFrame';
import PortalExactRouteFrame from './PortalExactRouteFrame';

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects/current-project/design-workbench',
  useSearchParams: () => new URLSearchParams(),
}));

describe('DesignWorkbenchPendingFrame', () => {
  it('renders the final three-column workbench structure with inline pending values', () => {
    const markup = renderToStaticMarkup(
      <DesignWorkbenchPendingFrame projectId="project one" />,
    );

    expect(markup).toContain('data-portal-page-shell="design-workbench"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('data-workbench-object-rail="true"');
    expect(markup).toContain('data-workbench-workspace="true"');
    expect(markup).toContain('data-workbench-inspector="true"');
    expect(markup).toContain('Drawing workbench primary navigation');
    expect(markup).toContain('3D Review');
    expect(markup).toContain('Plan Editor');
    expect(markup).toContain('Sheet Output');
    expect(markup).toContain('data-portal-value-slot="loading"');
    expect(markup).toContain('href="/staff/projects/project%20one"');
  });

  it('is the frame selected for a workbench route target', () => {
    const markup = renderToStaticMarkup(
      <PortalExactRouteFrame
        route="design-workbench"
        targetHref="/staff/projects/project%20one/design-workbench"
      />,
    );

    expect(markup).toContain('data-portal-page-shell="design-workbench"');
    expect(markup).toContain('href="/staff/projects/project%20one"');
  });

  it('does not import workbench, drawing, geometry, costing, or calculator runtime', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'apps/portal/components/page-state/DesignWorkbenchPendingFrame.tsx',
      ),
      'utf8',
    );
    const importPaths = Array.from(
      source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
      (match) => match[1]!,
    );
    const forbiddenRuntimeImport = /^(?:@sp\/(?:geometry|costing)|@\/(?:components|lib)\/drawings|@\/app\/staff\/projects\/\[projectId\]\/design-workbench|@\/app\/staff\/calculator)/;

    expect(importPaths).toEqual([
      '@/components/navigation/PortalRouteLink',
      './PortalPendingValue',
      './DesignWorkbenchPendingFrame.module.css',
    ]);
    expect(importPaths.filter((importPath) => forbiddenRuntimeImport.test(importPath))).toEqual([]);
  });
});
