import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_PINNED_WIDTH_PX,
  SIDEBAR_RAIL_WIDTH_PX,
} from '@/components/navigation/sidebarLayout';

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('foundation style guardrails', () => {
  it('does not hide document overflow to mask layout defects', () => {
    const tokens = read('apps/portal/components/ui/foundation/foundation.tokens.css');
    const catalogue = read('apps/portal/app/staff/ui-foundation/ui-foundation.module.css');
    expect(`${tokens}\n${catalogue}`).not.toMatch(/overflow-x:\s*clip/);
  });

  it('stops indefinite loading motion and pressed transforms for reduced motion', () => {
    const controls = read('apps/portal/components/ui/foundation/FoundationControls.module.css');
    const surfaces = read('apps/portal/components/ui/foundation/FoundationSurfaces.module.css');
    expect(controls).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.spinner\s*\{\s*animation:\s*none/);
    expect(controls).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?transform:\s*none/);
    expect(surfaces).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?animation:\s*none/);
  });

  it('uses a dark semantic foreground for action orange', () => {
    const tokens = read('apps/portal/components/ui/foundation/foundation.tokens.css');
    const controls = read('apps/portal/components/ui/foundation/FoundationControls.module.css');
    expect(tokens).toContain('--ui-action-foreground: #11110f');
    expect(controls).toContain('--control-colour: var(--ui-action-foreground)');
  });

  it('keeps shell dimensions, safe areas, touch targets, and motion rules aligned', () => {
    const globals = read('apps/portal/app/globals.css');
    const tokens = read('apps/portal/components/ui/foundation/foundation.tokens.css');
    const shell = read('apps/portal/components/layout/PortalShell.module.css');
    const projectPage = read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css');
    const calculatorGrid = read('apps/portal/app/staff/calculator/CalculatorGrid.module.css');
    const calculatorTrust = read('apps/portal/app/staff/calculator/CalculatorTrustUi.module.css');
    const rail = read('apps/portal/components/navigation/SidebarRail.module.css');
    const panel = read('apps/portal/components/navigation/PortalSidebarPanel.module.css');
    const drawer = read('apps/portal/components/ui/drawer/Drawer.module.css');

    expect(tokens).toContain(`--ui-sidebar-expanded: ${SIDEBAR_PINNED_WIDTH_PX}px`);
    expect(tokens).toContain(`--ui-sidebar-collapsed: ${SIDEBAR_RAIL_WIDTH_PX}px`);
    expect(shell).toMatch(/height:\s*calc\(var\(--ui-mobile-bar,[^)]+\) \+ env\(safe-area-inset-top\)\)/);
    expect(shell).toMatch(/padding-top:\s*calc\(var\(--ui-mobile-bar,[^)]+\) \+ env\(safe-area-inset-top\)\)/);
    expect(globals).toMatch(/max-width:\s*960px[\s\S]*?overflow-x:\s*clip\s*!important/);
    expect(globals).not.toMatch(/max-width:\s*960px[\s\S]*?overflow-x:\s*hidden\s*!important/);
    expect(shell).toContain('--portal-sticky-content-top: 0px');
    expect(shell).toMatch(/--portal-sticky-content-top:\s*calc\(var\(--ui-mobile-bar,[^)]+\) \+ env\(safe-area-inset-top\)\)/);
    expect(projectPage).toMatch(
      /--project-page-sticky-masthead-height:\s*var\(\s*--project-page-masthead-height,\s*0px\s*\)/,
    );
    expect(projectPage).toMatch(/\.pageFrameMastheadSlotSticky\s*\{[\s\S]*?top:\s*var\(--portal-sticky-content-top,\s*0px\)/);
    expect(projectPage).toMatch(/max-width:\s*767px[\s\S]*?--project-page-sticky-masthead-height:\s*0px/);
    expect(calculatorGrid).toContain('--calculator-sticky-top: 0px');
    expect(calculatorGrid).toMatch(
      /max-width:\s*1119px[\s\S]*?\.embeddedPage\s*\{[\s\S]*?var\(--project-page-sticky-masthead-height,\s*0px\)/,
    );
    expect(calculatorTrust).toMatch(/position:\s*sticky;\s*top:\s*var\(--calculator-sticky-top,\s*0px\)/);
    expect(drawer).toContain('padding-top: env(safe-area-inset-top)');
    expect(panel).toMatch(/drawer[\s\S]*?\.childRow\s*\{\s*min-height:\s*44px/);
    expect(rail).toMatch(/max-width:\s*899px[\s\S]*?\.rail\s*\{\s*display:\s*none/);
    expect(`${shell}\n${rail}\n${panel}`).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
