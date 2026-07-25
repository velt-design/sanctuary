import { expect, test, type Locator, type Page } from '@playwright/test';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';
import { expectStableDisclosureHydration } from './support/marketingDisclosureHydration';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const phaseOneCapture = process.env.MARKETING_PHASE_ONE_CAPTURE === '1';

const mobileViewports = [
  { name: '430px', width: 430, height: 932 },
  { name: '390px', width: 390, height: 844 },
  { name: '360px', width: 360, height: 800 },
] as const;

type DisclosureContract = {
  selector: string;
  count: number;
  idAttribute?: string;
  ids?: readonly string[];
  labels?: readonly string[];
};

type RouteCase = {
  id: string;
  path: string;
  canonicalPath: string;
  maximumVisibleWords: number;
  maximumVisibleHeadingRegions: number;
  mobileSignals: readonly string[];
  primaryAction: {
    name: string;
    href: string;
  };
  disclosures?: DisclosureContract;
  supporting?: {
    selector: string;
    phrase: string;
  };
  stableSections: readonly string[];
  meaningfulLinks: readonly string[];
  schemaTypes: readonly string[];
};

const homepageEnquiryHref = buildEnquiryHref({
  enquiryType: 'residential',
  sourcePath: '/',
  sourceComponent: 'hero',
});
const productsEnquiryHref = buildEnquiryHref({
  sourcePath: '/products',
  sourceComponent: 'product_cta',
});
const gableEnquiryHref = buildEnquiryHref({
  sourcePath: '/products/pergolas/gable',
  sourceComponent: 'product_cta',
  sourceProduct: 'gable',
});

const routeCases: readonly RouteCase[] = [
  {
    id: 'homepage',
    path: '/',
    canonicalPath: '',
    maximumVisibleWords: 800,
    maximumVisibleHeadingRegions: 9,
    mobileSignals: [
      'Bespoke pergolas, built around the architecture.',
      'Warkworth Outdoor Room',
      'Read about custom design conditions',
      'Get an initial project estimate',
    ],
    primaryAction: {
      name: 'Get an initial project estimate',
      href: homepageEnquiryHref,
    },
    disclosures: {
      selector: 'details[data-mobile-disclosure]',
      count: 7,
      labels: [
        'View the design response',
        'Commercial and professional projects',
        'How Sanctuary approaches the design',
        'Compare four pergola forms',
        'Compare roof and material approaches',
        'Plan integrated comfort options',
        'More helpful project information',
      ],
    },
    supporting: {
      selector: 'details[data-mobile-disclosure]',
      phrase: 'Design constraint',
    },
    stableSections: [
      '[data-home-section="featured-project"]',
      '[data-home-section="planning-options"]',
      '[data-home-section="qualified-enquiry"]',
    ],
    meaningfulLinks: [
      '/projects',
      '/pergolas-auckland',
      '/products',
      '/pergola-guides',
    ],
    schemaTypes: ['WebSite', 'WebPage'],
  },
  {
    id: 'residential service',
    path: '/pergolas-auckland',
    canonicalPath: '/pergolas-auckland',
    maximumVisibleWords: 1_050,
    maximumVisibleHeadingRegions: 8,
    mobileSignals: [
      'Pergolas for Auckland homes, designed from the house out',
      'Three homes. Three different answers.',
      'Roof forms, site checks and useful guides',
      'Send photos and rough dimensions',
    ],
    primaryAction: {
      name: 'Send photos and rough dimensions',
      href: '#project-details',
    },
    disclosures: {
      selector: 'details[data-mobile-content-disclosure]',
      count: 1,
      idAttribute: 'data-mobile-content-disclosure',
      ids: ['service-planning-support'],
    },
    supporting: {
      selector:
        'details[data-mobile-content-disclosure="service-planning-support"]',
      phrase: 'Some answers should wait for the completed design',
    },
    stableSections: ['#project-evidence', '#clear-process', '#project-details'],
    meaningfulLinks: [
      '/projects',
      '/products/pergolas/gable',
      '/pergola-cost-auckland',
    ],
    schemaTypes: ['WebPage', 'Service', 'BreadcrumbList'],
  },
  {
    id: 'custom service',
    path: '/custom-pergolas-auckland',
    canonicalPath: '/custom-pergolas-auckland',
    maximumVisibleWords: 1_050,
    maximumVisibleHeadingRegions: 8,
    mobileSignals: [
      'Custom pergolas for sites where the obvious answer does not fit',
      'Three projects with three different reasons to be custom',
      'The custom work happens where conditions collide',
      'Request a design review',
    ],
    primaryAction: {
      name: 'Request a design review',
      href: '#project-details',
    },
    disclosures: {
      selector: 'details[data-seo-landing-disclosure]',
      count: 1,
      idAttribute: 'data-seo-landing-disclosure',
      ids: ['custom-planning-support'],
    },
    supporting: {
      selector:
        'details[data-seo-landing-disclosure="custom-planning-support"]',
      phrase: 'Custom does not make technical boundaries disappear',
    },
    stableSections: [
      '#custom-project-evidence',
      '#custom-process',
      '#project-details',
    ],
    meaningfulLinks: [
      '/projects',
      '/pergola-cost-auckland',
      '/products',
    ],
    schemaTypes: ['WebPage', 'Service', 'BreadcrumbList'],
  },
  {
    id: 'product hub',
    path: '/products',
    canonicalPath: '/products',
    maximumVisibleWords: 700,
    maximumVisibleHeadingRegions: 8,
    mobileSignals: [
      'Cover the deck. Keep the light.',
      'Different houses lead to different answers.',
      'measured house, drainage path',
      'Send your project details',
    ],
    primaryAction: {
      name: 'Send your project details',
      href: productsEnquiryHref,
    },
    disclosures: {
      selector: 'details[data-product-mobile-disclosure]',
      count: 2,
      idAttribute: 'data-product-mobile-disclosure',
      ids: ['form-comparison', 'planning-guides'],
    },
    supporting: {
      selector:
        'details[data-product-mobile-disclosure="planning-guides"]',
      phrase: 'Pergola cost and scope',
    },
    stableSections: ['#pergola-forms', '#screens-walls', '#lighting-heating'],
    meaningfulLinks: [
      '/products/pergolas/gable',
      '/projects',
      '/pergola-cost-auckland',
    ],
    schemaTypes: ['CollectionPage', 'ItemList'],
  },
  {
    id: 'product detail',
    path: '/products/pergolas/gable',
    canonicalPath: '/products/pergolas/gable',
    maximumVisibleWords: 650,
    maximumVisibleHeadingRegions: 9,
    mobileSignals: [
      'Gable pergola',
      'Built evidence',
      'The project must resolve',
      'Send your project details',
    ],
    primaryAction: {
      name: 'Send your project details',
      href: gableEnquiryHref,
    },
    disclosures: {
      selector: 'details[data-product-mobile-disclosure]',
      count: 3,
      idAttribute: 'data-product-mobile-disclosure',
      ids: [
        'fit-and-definition',
        'specification-and-tradeoffs',
        'related-support',
      ],
    },
    supporting: {
      selector:
        'details[data-product-mobile-disclosure="specification-and-tradeoffs"]',
      phrase: 'Structure and materials',
    },
    stableSections: [
      '#product-fit',
      '[data-product-gallery="primary"]',
    ],
    meaningfulLinks: [
      '/products',
      '/projects/warkworth-outdoor-room',
      '/gable-pergolas-auckland',
    ],
    schemaTypes: ['Product', 'BreadcrumbList', 'FAQPage'],
  },
  {
    id: 'commercial service',
    path: '/commercial-pergolas-auckland',
    canonicalPath: '/commercial-pergolas-auckland',
    maximumVisibleWords: 1_150,
    maximumVisibleHeadingRegions: 8,
    mobileSignals: [
      'You run the venue. We manage the pergola project.',
      'See how completed venues made outdoor space part of the business',
      'How coordination protects the operation',
      'Discuss your venue',
    ],
    primaryAction: {
      name: 'Discuss your venue',
      href: '#project-details',
    },
    disclosures: {
      selector: 'details[data-seo-landing-disclosure]',
      count: 3,
      idAttribute: 'data-seo-landing-disclosure',
      ids: [
        'commercial-value-detail',
        'commercial-coordination-detail',
        'commercial-planning-support',
      ],
    },
    supporting: {
      selector:
        'details[data-seo-landing-disclosure="commercial-coordination-detail"]',
      phrase: 'Plan the installation around the operation, not just the footprint',
    },
    stableSections: [
      '#commercial-projects',
      '#commercial-process',
      '#project-details',
    ],
    meaningfulLinks: [
      '/projects',
      '/custom-pergolas-auckland',
      '/pergola-cost-auckland',
    ],
    schemaTypes: ['WebPage', 'Service', 'BreadcrumbList'],
  },
  {
    id: 'guide hub',
    path: '/pergola-guides',
    canonicalPath: '/pergola-guides',
    maximumVisibleWords: 575,
    maximumVisibleHeadingRegions: 7,
    mobileSignals: [
      'Find the guide for the decision in front of you',
      'Warkworth outdoor room',
      'Three chapters. One connected design.',
      'Browse all guides',
    ],
    primaryAction: {
      name: 'Browse all guides',
      href: '#guide-library',
    },
    stableSections: [
      '#guide-library',
      '#plan-the-project',
      '#compare-scope-and-components',
    ],
    meaningfulLinks: [
      '/pergolas-auckland',
      '/custom-pergolas-auckland',
      '/pergola-cost-auckland',
    ],
    schemaTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  },
  {
    id: 'guide detail',
    path: '/pergola-cost-auckland',
    canonicalPath: '/pergola-cost-auckland',
    maximumVisibleWords: 1_350,
    maximumVisibleHeadingRegions: 11,
    mobileSignals: [
      'A useful pergola price starts with a defined scope, not a square-metre guess',
      'Project photography reveals what an area figure leaves out',
      'not a square-metre guess',
      'Request a scoped first look',
    ],
    primaryAction: {
      name: 'Request a scoped first look',
      href: '#project-details',
    },
    disclosures: {
      selector: 'details[data-seo-landing-disclosure]',
      count: 1,
      idAttribute: 'data-seo-landing-disclosure',
      ids: ['pergola-cost-auckland-supporting-depth'],
    },
    supporting: {
      selector:
        'details[data-seo-landing-disclosure="pergola-cost-auckland-supporting-depth"]',
      phrase: 'A trustworthy total has a readable scope behind it',
    },
    stableSections: [
      '#cost-projects',
      '#cost-drivers',
      '#cost-process',
      '#project-details',
    ],
    meaningfulLinks: [
      '/pergola-guides',
      '/custom-pergolas-auckland',
      '/projects',
    ],
    schemaTypes: ['WebPage', 'BreadcrumbList'],
  },
  {
    id: 'contact introduction',
    path: '/contact?enquiry_type=residential',
    canonicalPath: '/contact',
    maximumVisibleWords: 450,
    maximumVisibleHeadingRegions: 4,
    mobileSignals: [
      'Tell us about the space you want to cover.',
      'Warkworth Outdoor Room',
      'The design, materials and exact dimensions can be worked through later',
      'Start your project brief',
    ],
    primaryAction: {
      name: 'Start your project brief',
      href: '#contact-form',
    },
    stableSections: ['.contact-hero', '#contact-form', '.contact-guidance'],
    meaningfulLinks: ['/projects/warkworth-outdoor-room', '/privacy'],
    schemaTypes: ['Organization', 'LocalBusiness'],
  },
] as const;

async function preparePage(page: Page, reducedMotion = false) {
  await page.emulateMedia({
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'sp_consent_v1',
      JSON.stringify({
        analytics: false,
        marketing: false,
        updatedAt: '2026-07-25T00:00:00.000Z',
        version: 1,
      }),
    );
  });
}

async function gotoCase(page: Page, routeCase: RouteCase) {
  const response = await page.goto(routeCase.path, {
    waitUntil: 'networkidle',
  });
  expect(response?.ok(), `${routeCase.path} should resolve`).toBe(true);

  const visibleMains = page.locator('main:visible');
  await expect(visibleMains).toHaveCount(1);
  const main = visibleMains.first();
  await expect(main.locator('h1:visible')).toHaveCount(1);
  return main;
}

function directSummaries(disclosures: Locator) {
  return disclosures.locator(':scope > summary');
}

async function expectDisclosureIdentity(
  disclosures: Locator,
  contract: DisclosureContract,
  expectAccessibleNames = true,
) {
  await expect(disclosures).toHaveCount(contract.count);

  if (contract.idAttribute && contract.ids) {
    expect(
      await disclosures.evaluateAll(
        (items, attribute) =>
          items.map((item) => item.getAttribute(attribute) ?? ''),
        contract.idAttribute,
      ),
    ).toEqual(contract.ids);
  }

  if (contract.labels) {
    const summaries = directSummaries(disclosures);
    expect(
      (await summaries.allTextContents()).map((label) =>
        label.trim().replace(/\s+/g, ' '),
      ),
    ).toEqual(contract.labels);

    if (expectAccessibleNames) {
      for (let index = 0; index < contract.labels.length; index += 1) {
        await expect(summaries.nth(index)).toHaveAccessibleName(
          contract.labels[index],
        );
      }
    }
  }
}

async function expectMobileDisclosures(
  main: Locator,
  contract: DisclosureContract,
) {
  const disclosures = main.locator(contract.selector);
  await expectDisclosureIdentity(disclosures, contract);
  await expect
    .poll(() =>
      disclosures.evaluateAll((items) =>
        items.every((item) => !(item as HTMLDetailsElement).open),
      ),
    )
    .toBe(true);

  const summaries = directSummaries(disclosures);
  await expect(summaries).toHaveCount(contract.count);

  for (let index = 0; index < contract.count; index += 1) {
    const summary = summaries.nth(index);
    await expect(summary).toBeVisible();
    const bounds = await summary.boundingBox();
    expect(bounds, `disclosure ${index + 1} should have layout bounds`).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect((await summary.innerText()).trim().length).toBeGreaterThan(0);
  }
}

async function getVisibleContentState(main: Locator) {
  return main.evaluate((element) => {
    const wordCount = (value: string) =>
      value.trim().match(/\S+/g)?.length ?? 0;
    const visibleHeadings = [
      ...element.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    ].filter((heading) => heading.checkVisibility());
    const headingRegions = new Set(
      visibleHeadings
        .filter((heading) => heading.matches('h1, h2'))
        .map((heading) =>
          heading.closest('section, form, article, aside'),
        )
        .filter(Boolean),
    );

    return {
      copy: element.innerText,
      headingLevels: visibleHeadings.map((heading) =>
        Number.parseInt(heading.tagName.slice(1), 10),
      ),
      headingRegions: headingRegions.size,
      words: Math.max(
        0,
        wordCount(element.innerText)
          - [...element.querySelectorAll<HTMLElement>('.visually-hidden')]
            .filter((node) => node.checkVisibility())
            .reduce(
              (total, node) => total + wordCount(node.innerText),
              0,
            ),
      ),
    };
  });
}

async function expectLogicalVisibleHeadingHierarchy(main: Locator) {
  const { headingLevels } = await getVisibleContentState(main);
  expect(headingLevels.length).toBeGreaterThan(0);
  expect(headingLevels[0]).toBe(1);
  expect(headingLevels.filter((level) => level === 1)).toHaveLength(1);

  for (let index = 1; index < headingLevels.length; index += 1) {
    expect(
      headingLevels[index],
      `visible heading ${index + 1} should not skip a level`,
    ).toBeLessThanOrEqual(headingLevels[index - 1] + 1);
  }
}

async function expectUniqueIds(page: Page) {
  const duplicates = await page.locator('[id]').evaluateAll((elements) => {
    const counts = new Map<string, number>();
    for (const element of elements) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
  });
  expect(duplicates).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, main: Locator) {
  const evidence = await main.evaluate((element) => {
    const documentElement = document.documentElement;
    const viewportWidth = documentElement.clientWidth;
    const isUserPerceivable = (candidate: HTMLElement) =>
      candidate.checkVisibility()
      && !candidate.closest([
        '[hidden]',
        '[inert]',
        '[aria-hidden="true"]',
        '.acrylic-form__honeypot',
        '.contact-form__honeypot',
      ].join(', '));
    const offenders = [element, ...element.querySelectorAll<HTMLElement>('*')]
      .filter(isUserPerceivable)
      .flatMap((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        if (
          bounds.width < 1
          || (bounds.left >= -1 && bounds.right <= viewportWidth + 1)
        ) {
          return [];
        }
        return [{
          className:
            typeof candidate.className === 'string'
              ? candidate.className.slice(0, 120)
              : '',
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          tagName: candidate.tagName,
        }];
      });
    const nestedHorizontalScrollers = [
      ...element.querySelectorAll<HTMLElement>('*'),
    ]
      .filter(isUserPerceivable)
      .filter((candidate) => {
        const overflowX = getComputedStyle(candidate).overflowX;
        return /(auto|scroll)/.test(overflowX)
          && candidate.scrollWidth > candidate.clientWidth + 1;
      })
      .map((candidate) => ({
        className:
          typeof candidate.className === 'string'
            ? candidate.className.slice(0, 120)
            : '',
        tagName: candidate.tagName,
      }));

    return {
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      nestedHorizontalScrollers,
      offenders: offenders.slice(0, 20),
    };
  });

  expect(evidence.documentScrollWidth).toBeLessThanOrEqual(
    evidence.documentClientWidth + 1,
  );
  expect(evidence.bodyScrollWidth).toBeLessThanOrEqual(
    evidence.bodyClientWidth + 1,
  );
  expect(evidence.nestedHorizontalScrollers).toEqual([]);
  expect(evidence.offenders).toEqual([]);
  await expect(main).toBeVisible();
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
}

async function expectPrimaryAction(
  main: Locator,
  routeCase: RouteCase,
  viewportHeight?: number,
) {
  const action = main
    .getByRole('link', {
      name: routeCase.primaryAction.name,
      exact: true,
    })
    .first();
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute('href', routeCase.primaryAction.href);
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  if (viewportHeight !== undefined) {
    expect(
      bounds!.y,
      `${routeCase.id} should keep its first primary action in the initial viewport`,
    ).toBeLessThan(viewportHeight);
  }
}

async function expectResidentialPostEvidenceAction(main: Locator) {
  await expect(main.locator('[data-service-major-section]')).toHaveCount(6);
  await expect(main.locator('#project-evidence .acrylic-project-card')).toHaveCount(3);
  await expect(main.locator('section:has(#clear-process) li')).toHaveCount(3);

  const firstLayerWords = await main.evaluate((element) => {
    const finalEnquiry = element.querySelector('[data-service-final-enquiry]');
    const firstLayerRoots = [...element.children]
      .filter((child) => (
        !child.matches('script, style, noscript')
        && (
          !finalEnquiry
          || Boolean(
            child.compareDocumentPosition(finalEnquiry)
            & Node.DOCUMENT_POSITION_FOLLOWING
          )
        )
      ));
    const firstLayer = firstLayerRoots.flatMap((root) => {
      const words: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();

      while (current) {
        const parent = current.parentElement;
        const closedDisclosure = parent?.closest('details:not([open])');
        const isVisibleSummary = closedDisclosure
          ? Boolean(parent?.closest('summary'))
          : true;

        if (parent?.checkVisibility() && isVisibleSummary) {
          words.push(current.textContent ?? '');
        }
        current = walker.nextNode();
      }

      return words;
    }).join(' ');

    return firstLayer.trim().match(/\S+/g)?.length ?? 0;
  });
  expect(firstLayerWords).toBeGreaterThanOrEqual(630);
  expect(firstLayerWords).toBeLessThanOrEqual(721);

  const action = main.getByRole('link', {
    name: 'Discuss my site',
    exact: true,
  });
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute('href', '#project-details');

  const actionBounds = await action.boundingBox();
  const evidenceBounds = await main.locator('#project-evidence').boundingBox();
  const formBounds = await main.locator('#project-details').boundingBox();
  expect(actionBounds).not.toBeNull();
  expect(evidenceBounds).not.toBeNull();
  expect(formBounds).not.toBeNull();
  expect(actionBounds!.height).toBeGreaterThanOrEqual(44);
  expect(actionBounds!.width).toBeGreaterThanOrEqual(44);
  expect(actionBounds!.y).toBeGreaterThan(evidenceBounds!.y);
  expect(actionBounds!.y).toBeLessThan(formBounds!.y);
}

async function expectCustomServiceJourney(main: Locator) {
  const majorSectionsBeforeFinalEnquiry = await main.evaluate((element) => {
    const finalEnquiry = element.querySelector('.acrylic-section--final-cta');

    return [...element.children]
      .filter((child) => child.matches('section, details'))
      .filter((child) => (
        !finalEnquiry
        || Boolean(
          child.compareDocumentPosition(finalEnquiry)
          & Node.DOCUMENT_POSITION_FOLLOWING
        )
      ))
      .length;
  });

  expect(majorSectionsBeforeFinalEnquiry).toBe(6);
  await expect(
    main.locator('#custom-project-evidence .acrylic-project-card'),
  ).toHaveCount(3);
  await expect(
    main.locator('section:has(#custom-process-title) li'),
  ).toHaveCount(3);
  await expect(
    main.getByRole('navigation', { name: 'Pergola guide progression' }),
  ).toHaveCount(0);
}

async function expectProductSummariesAreNotClamped(main: Locator) {
  const summaryText = main.locator([
    'a[aria-label^="Explore "] p',
    'details[data-product-mobile-disclosure] > summary > span:first-child',
    'details[data-product-mobile-disclosure="related-support"] article p',
  ].join(', '));
  expect(await summaryText.count()).toBeGreaterThan(0);

  const clipped = await summaryText.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const lineClamp = style.getPropertyValue('-webkit-line-clamp');
      const isClipped =
        (/^\d+$/.test(lineClamp) && Number.parseInt(lineClamp, 10) > 0)
        || ['hidden', 'clip'].includes(style.overflowX)
        || ['hidden', 'clip'].includes(style.overflowY)
        || style.textOverflow === 'ellipsis';
      return isClipped
        ? [{
            className:
              typeof element.className === 'string'
                ? element.className
                : '',
            lineClamp,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            text: element.textContent?.trim().slice(0, 100) ?? '',
            textOverflow: style.textOverflow,
          }]
        : [];
    }),
  );

  expect(clipped).toEqual([]);
}

function schemaTypesFromScripts(scripts: readonly string[]) {
  return scripts.flatMap((script) => {
    const parsed = JSON.parse(script) as
      | Record<string, unknown>
      | Array<Record<string, unknown>>;
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    return nodes.flatMap((node) => {
      const directType = node['@type'];
      const graph = Array.isArray(node['@graph'])
        ? node['@graph'] as Array<Record<string, unknown>>
        : [];
      return [
        ...(typeof directType === 'string' ? [directType] : []),
        ...graph.flatMap((item) =>
          typeof item['@type'] === 'string' ? [item['@type']] : [],
        ),
      ];
    });
  });
}

for (const viewport of mobileViewports) {
  test(`mobile first-layer density and semantics hold across families at ${viewport.name}`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize(viewport);
    await preparePage(page);

    for (const routeCase of routeCases) {
      const main = await gotoCase(page, routeCase);
      const state = await getVisibleContentState(main);
      const normalizedCopy = state.copy.toLowerCase();

      expect(
        state.words,
        `${routeCase.id} should stay within its measured mobile word budget`,
      ).toBeGreaterThanOrEqual(200);
      expect(
        state.words,
        `${routeCase.id} should stay within its measured mobile word budget`,
      ).toBeLessThanOrEqual(routeCase.maximumVisibleWords);
      expect(
        state.headingRegions,
        `${routeCase.id} should keep a bounded first layer of heading-bearing regions`,
      ).toBeLessThanOrEqual(routeCase.maximumVisibleHeadingRegions);

      for (const signal of routeCase.mobileSignals) {
        expect(
          normalizedCopy,
          `${routeCase.id} should retain the visible signal "${signal}"`,
        ).toContain(signal.toLowerCase());
      }

      await expectLogicalVisibleHeadingHierarchy(main);
      await expectUniqueIds(page);
      await expectNoHorizontalOverflow(page, main);
      await expectPrimaryAction(main, routeCase, viewport.height);

      if (routeCase.disclosures) {
        await expectMobileDisclosures(main, routeCase.disclosures);

        const summaries = directSummaries(
          main.locator(routeCase.disclosures.selector),
        );
        for (let index = 0; index < routeCase.disclosures.count; index += 1) {
          await summaries.nth(index).click();
        }
        await expect
          .poll(() =>
            main.locator(routeCase.disclosures!.selector).evaluateAll((items) =>
              items.every((item) => (item as HTMLDetailsElement).open),
            ),
          )
          .toBe(true);
        await expectNoHorizontalOverflow(page, main);
      }

      if (
        routeCase.id === 'product hub'
        || routeCase.id === 'product detail'
      ) {
        await expectProductSummariesAreNotClamped(main);
      }

      if (routeCase.id === 'residential service') {
        await expectResidentialPostEvidenceAction(main);
      }
      if (routeCase.id === 'custom service') {
        await expectCustomServiceJourney(main);
      }
    }
  });
}

test('desktop keeps responsive detail expanded and preserves SEO, sections and links', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  for (const routeCase of routeCases) {
    const main = await gotoCase(page, routeCase);
    await expectLogicalVisibleHeadingHierarchy(main);
    await expectUniqueIds(page);
    await expectNoHorizontalOverflow(page, main);
    await expectPrimaryAction(main, routeCase);

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${routeCase.canonicalPath}`,
    );
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
      'content',
      /noindex/i,
    );

    const schemaTypes = schemaTypesFromScripts(
      await page.locator('script[type="application/ld+json"]').allTextContents(),
    );
    for (const schemaType of routeCase.schemaTypes) {
      expect(
        schemaTypes,
        `${routeCase.id} should retain ${schemaType} structured data`,
      ).toContain(schemaType);
    }

    if (routeCase.disclosures) {
      const disclosures = main.locator(routeCase.disclosures.selector);
      await expectDisclosureIdentity(
        disclosures,
        routeCase.disclosures,
        false,
      );
      await expect
        .poll(() =>
          disclosures.evaluateAll((items) =>
            items.every((item) => (item as HTMLDetailsElement).open),
          ),
        )
        .toBe(true);

      for (let index = 0; index < routeCase.disclosures.count; index += 1) {
        const disclosure = disclosures.nth(index);
        await expect(disclosure).toBeVisible();
        await expect(disclosure.locator(':scope > summary')).toBeHidden();
        await expect(disclosure.locator(':scope > div')).toBeVisible();
      }
    }

    if (routeCase.supporting) {
      const supporting = main.locator(routeCase.supporting.selector).first();
      await expect(supporting).toBeVisible();
      await expect(supporting).toContainText(routeCase.supporting.phrase);
    }

    for (const selector of routeCase.stableSections) {
      await expect(
        main.locator(selector).first(),
        `${routeCase.id} should retain ${selector}`,
      ).toBeVisible();
    }
    expect(
      await main.evaluate((element, selectors) => {
        const nodes = selectors.map((selector) =>
          element.querySelector(selector),
        );
        return nodes.every(Boolean)
          && nodes.every((node, index) =>
            index === nodes.length - 1
            || Boolean(
              node!.compareDocumentPosition(nodes[index + 1]!)
              & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          );
      }, routeCase.stableSections),
      `${routeCase.id} should preserve representative section order`,
    ).toBe(true);

    for (const href of routeCase.meaningfulLinks) {
      await expect(
        main.locator(`a[href="${href}"]`).first(),
        `${routeCase.id} should retain ${href}`,
      ).toBeAttached();
    }
  }
});

test('mobile responsive disclosures have the same visual height before and after hydration', async ({
  page,
}) => {
  test.slow();
  await preparePage(page);
  await expectStableDisclosureHydration(page, mobileViewports, phaseOneCapture);
});

test('responsive disclosures are keyboard operable, visibly focused and reduced-motion safe', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);

  for (const routeCase of routeCases.filter(
    (candidate) => candidate.disclosures,
  )) {
    const main = await gotoCase(page, routeCase);
    const disclosure = main
      .locator(routeCase.disclosures!.selector)
      .first();
    const summary = disclosure.locator(':scope > summary');

    await expect(disclosure).not.toHaveAttribute('open', '');
    await summary.focus();
    await expect(summary).toBeFocused();

    const focusStyle = await summary.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(focusStyle.outlineWidth).toBeGreaterThan(0);

    const icon = summary.locator(':scope > span').last();
    await expect(icon).toBeAttached();
    expect(
      await icon.evaluate((element) =>
        getComputedStyle(element, '::after').transitionDuration,
      ),
    ).toBe('0s');

    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
  }
});

test('server-rendered journeys remain complete in JavaScript-disabled browser contexts', async ({
  baseURL,
  browser,
}) => {
  test.slow();
  expect(baseURL).toBeTruthy();
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const noJavaScriptCases = routeCases.filter((routeCase) =>
    [
      'homepage',
      'residential service',
      'custom service',
      'product hub',
      'product detail',
      'commercial service',
      'guide hub',
      'guide detail',
      'contact introduction',
    ].includes(routeCase.id),
  );

  try {
    for (const routeCase of noJavaScriptCases) {
      const response = await page.goto(routeCase.path, {
        waitUntil: 'load',
      });
      expect(response?.ok(), `${routeCase.path} should resolve without JS`).toBe(
        true,
      );
      const main = page.locator('main:visible');
      await expect(main).toHaveCount(1);
      await expect(main.locator('h1:visible')).toHaveCount(1);
      await expectPrimaryAction(main, routeCase);

      if (routeCase.disclosures) {
        const disclosures = main.locator(routeCase.disclosures.selector);
        await expectDisclosureIdentity(disclosures, routeCase.disclosures);
        await expect
          .poll(() =>
            disclosures.evaluateAll((items) =>
              items.every((item) => (item as HTMLDetailsElement).open),
            ),
          )
          .toBe(true);
      }

      if (routeCase.supporting) {
        const supporting = main.locator(routeCase.supporting.selector).first();
        await expect(supporting).toHaveAttribute('open', '');
        await expect(supporting).toContainText(routeCase.supporting.phrase);
        await expect(supporting.locator(':scope > div')).toBeVisible();
      }
    }
  } finally {
    await context.close();
  }
});

test('residential, commercial, product and professional enquiry context remains source aware', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  await page.goto('/pergolas-auckland', { waitUntil: 'networkidle' });
  await expect(page.locator('#acrylic-enquiry-type')).toHaveValue(
    'residential',
  );
  await expect(
    page.locator('header.site').getByRole('link', { name: 'Get an estimate' }),
  ).toHaveAttribute(
    'href',
    buildEnquiryHref({
      enquiryType: 'residential',
      sourcePath: '/pergolas-auckland',
      sourceComponent: 'header',
    }),
  );

  await page.goto('/commercial-pergolas-auckland', {
    waitUntil: 'networkidle',
  });
  await expect(page.locator('#acrylic-enquiry-type')).toHaveValue(
    'commercial',
  );
  await expect(
    page.locator('header.site').getByRole('link', { name: 'Get an estimate' }),
  ).toHaveAttribute(
    'href',
    buildEnquiryHref({
      enquiryType: 'commercial',
      sourcePath: '/commercial-pergolas-auckland',
      sourceComponent: 'header',
    }),
  );

  await page.goto('/products/pergolas/gable', {
    waitUntil: 'networkidle',
  });
  await expect(
    page.getByRole('link', { name: 'Send your project details' }).first(),
  ).toHaveAttribute('href', gableEnquiryHref);

  const professionalHref = buildEnquiryHref({
    enquiryType: 'professional',
    sourcePath: '/',
    sourceComponent: 'pathway',
  });
  await page.goto(professionalHref, { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('radio', {
      name: 'Architect, designer or builder',
      exact: false,
    }),
  ).toBeChecked();
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Professional enquiry',
  );
  expect(new URL(page.url()).searchParams.get('source_component')).toBe(
    'pathway',
  );
  expect(new URL(page.url()).searchParams.get('source_path')).toBe('/');
});

test('mobile fragment links reveal targets after cross-route clicks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const commercialLink = page.locator(
    'a[href="/commercial-pergolas-auckland#project-details"]',
    { hasText: 'Discuss a commercial project' },
  ).first();
  const commercialSourceDisclosure = page.locator(
    'details[data-mobile-disclosure]',
    { has: commercialLink },
  );
  await commercialSourceDisclosure.locator(':scope > summary').click();
  await commercialLink.click();

  await expect(page).toHaveURL(
    /\/commercial-pergolas-auckland#project-details$/,
  );
  const commercialTarget = page.locator('#project-details');
  await expect(commercialTarget).toBeVisible();
  await expect
    .poll(() =>
      commercialTarget.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBeLessThan(844);

  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator('main[data-homepage-variant="v2"]:visible'),
  ).toBeVisible();

  const comparisonLink = page.locator(
    'a[href="/pergolas-auckland#roofing-options"]',
  );
  const sourceDisclosure = page.locator('details[data-mobile-disclosure]', {
    has: comparisonLink,
  });
  await sourceDisclosure.locator(':scope > summary').click();
  await comparisonLink.click();

  await expect(page).toHaveURL(/\/pergolas-auckland#roofing-options$/);
  const target = page.locator('#roofing-options');
  const targetDisclosure = page.locator(
    'details[data-mobile-content-disclosure="service-planning-support"]',
  );
  await expect(targetDisclosure).toHaveAttribute('open', '');
  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBeLessThan(844);
});
