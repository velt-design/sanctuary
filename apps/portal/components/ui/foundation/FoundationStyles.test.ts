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
  it('uses available Overview width, independent natural columns, and the full wide Work desk arrangement', () => {
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
    expect(root.get('.layout')?.get('max-width')).toBe('none');
    expect(root.get('.grid')?.get('align-items')).toBe('start');
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
    let wide=false;
    sheet.walkAtRules('container',rule=>{if(rule.params==='(min-width:1600px)'){
      wide=true;expect(rule.toString()).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
      for(const region of ['.projectWork','.commercial','.orientation','.recent'])expect(rule.toString()).toContain(region);
    }});expect(wide).toBe(true);
  });
  it('allocates accepted agreements at all widths while keeping full long facts natively readable', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/QuotesTab.module.css'));
    const declarations = new Map<string, string>();
    sheet.walkRules(rule => {
      if (rule.selector !== '.acceptedWork') return;
      if (rule.parent?.type === 'root') {
        rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
      }
    });
    expect(declarations.has('block-size')).toBe(false);
    expect(declarations.get('overflow')).toBe('visible');
    expect(declarations.has('-webkit-line-clamp')).toBe(false);
  });

  it('keeps the complete project subtitle focusable and natively readable without a reserved line box', () => {
    const sheet = postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));
    const declarations = new Map<string, string>();
    sheet.walkRules(rule => {
      if (rule.selector !== '.mastheadSubtitle') return;
      rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    });
    expect(declarations.get('block-size')).toBe('auto');
    expect(declarations.get('white-space')).toBe('nowrap');
    expect(declarations.get('overflow')).toBe('auto');
    expect(declarations.get('scrollbar-gutter')).toBe('auto');
    expect(declarations.has('-webkit-line-clamp')).toBe(false);
  });
  it('keeps the natural project title and independent status control on a compact shared line', () => {
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
    expect(declarations.get('display')).toBe('flex');
    expect(declarations.get('align-items')).toBe('center');
    expect(declarations.get('grid-template-rows')).toBe('none');
    expect(badgeHeight).toBeGreaterThan(0);
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
    expect(projectPage).toContain('height:calc(100dvh - var(--portal-sticky-content-top,0px))');
    expect(projectPage).toContain('.pageFrame:not(.pageFrameCalculatorWorkspace) .pageFrameMastheadSlot { position:static; flex:none; }');
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

it('keeps full Overview facts in natural flow and the narrow composition independent of publication',()=>{
 const reading=postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOverviewReading.module.css'));
 const rules=new Map<string,Map<string,string>>();reading.walkRules(rule=>{const values=new Map<string,string>();rule.walkDecls(decl=>{values.set(decl.prop,decl.value);});rules.set(rule.selector,values);});
 expect(rules.get('.surface')?.get('container-type')).toBe('inline-size');expect(rules.get('.reading')?.get('overflow')).toBe('visible');expect(rules.get('.reading')?.get('height')).toBe('auto');
 expect(rules.has('.reading[data-overview-reading="payment"]')).toBe(false);expect(rules.get('.history')?.get('overflow')).toBe('visible');expect(rules.get('.history')?.has('height')).toBe(false);
 const layout=postcss.parse(read('apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOverviewLayout.module.css'));let container=false;layout.walkAtRules('container',rule=>{if(rule.params==='(max-width: 800px)'){container=true;expect(rule.toString()).toContain('grid-template-columns: minmax(0, 1fr)');}});expect(container).toBe(true);
 const site=read('apps/portal/components/site-visits/siteVisits.module.css');expect(site).not.toContain('.calendarStatus{height:44px');expect(site).toContain('.calendarContext:empty{display:none}');
});

it('keeps one viewport work scroller below the stationary header, with naturally sized title and tabs',()=>{
 const sheet=postcss.parse(read('apps/portal/components/projects/ProjectPage/ProjectPage.module.css'));const title=new Map<string,string>(),work=new Map<string,string>();let tabs=false;
 sheet.walkRules(rule=>{if(rule.selector.includes('[data-page-header-identity="true"] h1'))rule.walkDecls(decl=>{title.set(decl.prop,decl.value);});if(rule.selector==='.masthead .navigationRow :global(nav[aria-label="Project sections"])'){rule.walkDecls('overflow-x',decl=>{expect(decl.value).toBe('auto');tabs=true;});}if(rule.selector==='.pageFrame:not(.pageFrameCalculatorWorkspace) .pageFrameBody')rule.walkDecls(decl=>{work.set(decl.prop,decl.value);});});
 expect(title.get('block-size')).toBe('auto');expect(title.get('overflow')).toBe('auto');expect(title.get('scrollbar-gutter')).toBe('auto');expect(tabs).toBe(true);
 expect(work.get('flex')).toBe('1');expect(work.get('min-height')).toBe('0');expect(work.get('overflow')).toBe('auto');expect(work.get('scrollbar-gutter')).toBe('stable');expect(work.get('overflow-anchor')).toBe('none');
});

  it('keeps generic titles natural and project full-title disclosure independently owned', () => {
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
    // A generic title no longer reserves two blank rows or truncates detail names.
    expect(pinnedClamp).toBe(false);
    expect(read('apps/portal/components/layout/PageHeader.module.css')).not.toContain('min-height:2.2em');
    const contact = read('apps/portal/app/staff/contacts/[contactId]/ContactDetailClient.tsx');
    expect(contact).toContain('headingProps={{ tabIndex: 0, title: heading }}');
    expect(title.get('display')).toBe('block');
    expect(title.get('-webkit-line-clamp')).toBe('unset');
    expect(title.get('-webkit-box-orient')).toBe('initial');
    expect(title.get('min-height')).toBe('0');
    expect(title.get('max-height')).toBe('none');
    expect(title.get('overflow')).toBe('auto');
  });


it('uses natural core headers and lists instead of status lanes, empty table floors or competing Dashboard viewport tracks',()=>{
 const status=postcss.parse(read('apps/portal/components/page-state/ReadStatus.module.css'));
 status.walkRules(rule=>{if(rule.selector==='.root')rule.walkDecls(decl=>{expect(['height','block-size','min-height','min-block-size']).not.toContain(decl.prop);});});
 for(const path of ['apps/portal/app/staff/projects/ProjectsIndexClient.module.css','apps/portal/app/staff/contacts/ContactsIndexFrame.module.css']){
  const sheet=postcss.parse(read(path));sheet.walkRules(rule=>{if(rule.selector==='.listViewport'||rule.selector==='.listHeaderActions'||rule.selector==='.listCard > header')rule.walkDecls(decl=>{expect(['height','min-height','grid-template-rows']).not.toContain(decl.prop);});});
 }
 const dashboard=postcss.parse(read('apps/portal/app/dashboard/dashboard.module.css'));
 dashboard.walkRules(rule=>{if(['.page','.workspaceGrid','.workspaceGrid > div'].includes(rule.selector))rule.walkDecls(decl=>{expect(['height','min-height','grid-template-rows']).not.toContain(decl.prop);});});
 expect(read('apps/portal/components/installerPayouts/InstallerPayoutPage.module.css')).toContain('margin: 0 auto');
});


it('keeps Dashboard column cards in natural flow without obsolete named-area placement',()=>{
 const sheet=postcss.parse(read('apps/portal/app/dashboard/dashboard.module.css'));
 sheet.walkDecls('grid-area',()=>{throw new Error('Independent Dashboard column cards must not create implicit named areas');});
 expect(read('apps/portal/app/dashboard/DashboardFrame.tsx')).not.toContain('dash.content');
 expect(read('apps/portal/app/dashboard/DashboardFrame.tsx')).not.toContain('dash.layout');
 const finance=read('apps/portal/components/finance/FinanceRegister.module.css');
 expect(finance).not.toContain('min-height: 320px');expect(finance).not.toContain('height: 152px');expect(finance).not.toContain('max-width: 1600px');
 expect(finance).toContain('@container (max-width: 1120px)');
});


it('keeps Schedule feedback and real view controls in natural rows without an error-only scrollbar or report empty floors',()=>{
 const schedule=postcss.parse(read('apps/portal/app/staff/schedule/schedule.module.css'));
 schedule.walkRules(rule=>{if(rule.selector==='.headerActions')rule.walkDecls(decl=>{expect(['height','min-height','overflow-x']).not.toContain(decl.prop);});});
 expect(schedule.toString()).toContain("grid-template-columns:auto minmax(160px,1fr) auto");
 expect(schedule.toString()).toContain('.headerActions > :first-child { flex-basis:100%');
 for(const [path,selector] of [
  ['apps/portal/components/marketingPerformance/MarketingPerformance.module.css','.results'],
  ['apps/portal/components/marketingPerformance/CommercialOverview.module.css','.section'],
  ['apps/portal/components/marketingPerformance/DesignerPerformance.module.css','.section'],
  ['apps/portal/components/financials/Financials.module.css','.result'],
  ['apps/portal/app/admin/portal-actions/portalActions.module.css','.reviewSlot'],
 ] as const){postcss.parse(read(path)).walkRules(rule=>{if(rule.selector===selector)rule.walkDecls(decl=>{expect(['height','min-height']).not.toContain(decl.prop);});});}
});
