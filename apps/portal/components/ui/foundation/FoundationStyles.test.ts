import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_PINNED_WIDTH_PX,
  SIDEBAR_RAIL_WIDTH_PX,
} from '@/components/navigation/sidebarLayout';

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('foundation style guardrails', () => {
  it('composes the managed Work Card without changing the default card or private descendant scope', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkFilesCard.module.css'));
    const compositions = new Map<string, string[]>();
    sheet.walkRules(rule => {
      rule.walkDecls('composes', decl => {
        compositions.set(rule.selector, [...compositions.get(rule.selector) ?? [], decl.value]);
      });
    });
    expect(compositions.get('.workCard')).toEqual(['card from "./ProjectWorkSection.module.css"']);
    expect(compositions.has('.card')).toBe(false);
    const publicSurface = read('apps/portal/components/projects/ProjectPage/tabs/ProjectOverviewSurface.tsx');
    expect(publicSurface).not.toContain('import workStyles');
    expect(publicSurface).toContain('<ProjectWorkFilesSurface className={styles.workCard}');
    const privateSheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkSection.module.css'));
    let compound = false;
    privateSheet.walkRules(rule => {
      if (rule.selector === '.card .primaryAction > header') compound = true;
    });
    expect(compound).toBe(true);
  });
  it('uses the actual Overview width as the container for its unchanged region grid', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOverviewLayout.module.css'));
    const root = new Map<string, Map<string, string>>();
    sheet.walkRules(rule => {
      if (rule.parent?.type !== 'root') return;
      const declarations = new Map<string, string>();
      rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
      root.set(rule.selector, declarations);
    });
    expect(root.get('.layout')?.get('container-type')).toBe('inline-size');
    expect(root.get('.layout')?.get('width')).toBe('100%');
    expect(root.get('.layout')?.get('max-width')).toBe('var(--ui-content-max)');
    expect(root.get('.grid')?.get('grid-template-columns')).toBe('minmax(0, 1.1fr) minmax(320px, 1fr)');
    expect(root.get('.layout:not([data-has-exception]) > .grid')?.get('grid-template-areas')).toBe('"primary context" "admin admin"');
    for (const [name, params] of [['container', '(max-width: 800px)'], ['media', '(max-width: 768px)']]) {
      let matched = false;
      sheet.walkAtRules(name, rule => {
        if (rule.params !== params) return;
        matched = true;
        expect(rule.toString()).toContain('grid-template-columns: minmax(0, 1fr)');
        expect(rule.toString()).toContain('"exception" "primary" "context" "admin"');
        expect(rule.toString()).toContain('"primary" "context" "admin"');
      });
      expect(matched).toBe(true);
    }
  });
  it('allocates accepted agreements at all widths while keeping full long facts natively readable', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/QuotesTab.module.css'));
    const declarations = new Map<string, string>();
    let narrowHeight = 0;
    sheet.walkRules(rule => {
      if (rule.selector !== '.acceptedWork') return;
      if (rule.parent?.type === 'atrule' && rule.parent.name === 'media' && rule.parent.params === '(max-width: 720px)') {
        rule.walkDecls('block-size', decl => { narrowHeight = Number.parseFloat(decl.value); });
      } else if (rule.parent?.type === 'root') {
        rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
      }
    });
    expect(Number.parseFloat(declarations.get('block-size')!)).toBe(184);
    // Actual ordinary 390px agreement measured 226px including its direct Open action.
    expect(narrowHeight).toBeGreaterThanOrEqual(226 + 16);
    expect(declarations.get('overflow')).toBe('auto');
    expect(declarations.get('scrollbar-gutter')).toBe('stable');
    expect(declarations.has('-webkit-line-clamp')).toBe(false);
  });

  it('keeps the full project subtitle in two stable reading lines without clipping long facts', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));
    const declarations = new Map<string, string>();
    sheet.walkRules(rule => {
      if (rule.selector !== '.mastheadSubtitle') return;
      rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    });
    expect(Number.parseFloat(declarations.get('block-size')!)).toBe(2 * Number.parseFloat(declarations.get('line-height')!));
    expect(declarations.get('overflow')).toBe('auto');
    expect(declarations.get('scrollbar-gutter')).toBe('stable');
    expect(declarations.has('-webkit-line-clamp')).toBe(false);
  });
  it('keeps the project title and status on independent tracks at narrow and desktop widths', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));
    const declarations = new Map<string, string>();
    sheet.walkRules(rule => {
      if (rule.selector !== '.mastheadHeader :global([data-page-header-title-line="true"])' || rule.parent?.type !== 'root') return;
      rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    });
    const badgeSheet = postcss.parse(read('apps/portal/components/ui/foundation/SanctuaryStatus.module.css'));
    let badgeHeight = 0;
    badgeSheet.walkRules(rule => {
      if (rule.selector === '.stageBadge') rule.walkDecls('min-height', decl => { badgeHeight = Number.parseFloat(decl.value); });
    });
    expect(declarations.get('display')).toBe('grid');
    expect(declarations.get('grid-template-rows')).toBe(`auto ${badgeHeight}px`);
    expect(declarations.get('grid-template-columns')).toBe('minmax(0, 1fr)');
  });
  it('allocates the compact column pager summary and touch controls within its reading header', () => {
    const sheet = postcss.parse(read('apps/portal/components/ui/foundation/FoundationSurfaces.module.css'));
    const mobile = new Map<string, Map<string, string>>();
    sheet.walkAtRules('media', media => {
      if (media.params !== '(max-width: 767px)') return;
      media.walkRules(rule => {
        for (const selector of rule.selectors) {
          const values = mobile.get(selector) ?? new Map<string, string>();
          rule.walkDecls(decl => { values.set(decl.prop, decl.value); });
          mobile.set(selector, values);
        }
      });
    });
    const summary = mobile.get('.pagination[data-compact] .paginationSummary');
    const allocatedHeight = Number.parseFloat(mobile.get('.pagination[data-compact]')!.get('height')!);
    const controlHeight = Number.parseFloat(mobile.get('.paginationControls button')!.get('height')!);
    expect(summary?.get('flex')).toBe(`0 0 ${allocatedHeight - controlHeight}px`);
    expect(summary?.get('min-height')).toBe('0');
    expect(Number.parseFloat(summary!.get('line-height')!)).toBeLessThanOrEqual(allocatedHeight - controlHeight);
    expect(read('apps/portal/components/ui/foundation/FoundationSurfaces.module.css')).toContain('.paginationSummary { width: 17ch;');
  });
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

it('keeps Overview reading tracks and the first narrow-container composition independent of publication',()=>{
 const reading=postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOverviewReading.module.css'));
 const rules=new Map<string,Map<string,string>>();reading.walkRules(rule=>{const values=new Map<string,string>();rule.walkDecls(decl=>{values.set(decl.prop,decl.value);});rules.set(rule.selector,values);});
 expect(rules.get('.surface')?.get('container-type')).toBe('inline-size');expect(rules.get('.reading')?.get('overflow')).toBe('auto');expect(rules.get('.reading')?.get('height')).toBe('360px');
 expect(rules.get('.reading[data-overview-reading="payment"]')?.get('height')).toBe('400px');expect(rules.get('.history')?.get('overflow')).toBe('auto');
 const layout=postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOverviewLayout.module.css'));let container=false;layout.walkAtRules('container',rule=>{if(rule.params==='(max-width: 800px)'){container=true;expect(rule.toString()).toContain('grid-template-columns: minmax(0, 1fr)');}});expect(container).toBe(true);
 const site=read('apps/portal/components/site-visits/siteVisits.module.css');expect(site).toContain('.calendarStatus{height:44px;min-width:0}');expect(site).not.toContain('.calendarContext:empty{display:none}');
});

it('allocates the unknown and genuine project title plus tab scrollbar before publication',()=>{
 const sheet=postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));const title=new Map<string,string>();let tabs=false;
 sheet.walkRules(rule=>{if(rule.selector.includes('[data-page-header-identity="true"] h1'))rule.walkDecls(decl=>{title.set(decl.prop,decl.value);});if(rule.selector.includes('nav[aria-label="Project sections"]')){expect(rule.toString()).toContain('overflow-x: scroll');tabs=true;}});
 expect(title.get('block-size')).toBe('2lh');expect(title.get('overflow')).toBe('auto');expect(title.get('scrollbar-gutter')).toBe('stable');expect(tabs).toBe(true);
});

  it('keeps project native title scrolling above the pinned header clamp', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));
    const pinned = postcss.parse(read('apps/portal/components/layout/PageHeader.module.css'));
    const selector = '.masthead .mastheadHeader :global([data-page-header-identity="true"] h1)';
    const title = new Map<string, string>();
    let pinnedClamp = false;
    sheet.walkRules(rule => {
      if (rule.selector === selector && rule.parent?.type === 'root') rule.walkDecls(decl => { title.set(decl.prop, decl.value); });
    });
    pinned.walkRules(rule => {
      if (rule.selector === ":global([data-portal-sidebar-mode='pinned']) .variantDetail .title") {
        rule.walkDecls('-webkit-line-clamp', decl => { pinnedClamp = decl.value === '2'; });
      }
    });
    // Three class/attribute selectors plus h1 beats the pinned rule's three.
    expect(pinnedClamp).toBe(true);
    expect(title.get('display')).toBe('block');
    expect(title.get('-webkit-line-clamp')).toBe('unset');
    expect(title.get('-webkit-box-orient')).toBe('initial');
    expect(title.get('min-height')).toBe('2lh');
    expect(title.get('max-height')).toBe('2lh');
    expect(title.get('overflow')).toBe('auto');
  });
