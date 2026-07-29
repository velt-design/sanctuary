import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { products } from "../apps/marketing/data/products";

const publicOrigin = "https://www.sanctuarypergolas.co.nz";
const captureEnabled = process.env.MARKETING_PHASE_THREE_CAPTURE === "1";
const evidenceDirectory = resolve("artifacts/mobile-ux-phase-3/after");
const targetViewports = [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const serviceRoutes = [
  "/pergolas-auckland",
  "/custom-pergolas-auckland",
] as const;
const phaseThreeRoutes = [
  "/products",
  ...products.map((product) => product.route),
  ...serviceRoutes,
] as const;
const screenshotRoutes = new Set([
  "/products",
  "/products/pergolas/gable",
  "/products/lighting-heating/patio-heaters",
  ...serviceRoutes,
]);

type PageMetrics = {
  cls: number;
  directMajorChildren: number;
  disclosureIds: string[];
  documentHeight: number;
  documentWidth: number;
  domNodes: number;
  firstLayerWords: number;
  galleryImageElements: number;
  galleryUniqueImageSources: number;
  headingRegions: number;
  heroFetchPriority: string | null;
  heroLoading: string | null;
  mainHeight: number;
  majorSectionsBeforeFinal: number;
  responsiveGalleries: number;
  visibleWords: number;
};

async function createMeasuredPage(
  browser: Browser,
  baseURL: string,
  viewport: (typeof targetViewports)[number],
) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "sp_consent_v1",
      JSON.stringify({
        analytics: false,
        marketing: false,
        updatedAt: "2026-07-25T00:00:00.000Z",
        version: 1,
      }),
    );
    (window as typeof window & { __phaseThreeCls?: number }).__phaseThreeCls =
      0;
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) {
          const measuredWindow = window as typeof window & {
            __phaseThreeCls?: number;
          };
          measuredWindow.__phaseThreeCls =
            (measuredWindow.__phaseThreeCls ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  return { context, page: await context.newPage() };
}

async function warmFullPage(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolveStep) => setTimeout(resolveStep, 20));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
}

async function measurePage(page: Page): Promise<PageMetrics> {
  return page.locator("main:visible").evaluate((main) => {
    const wordCount = (value: string) =>
      value.trim().match(/\S+/g)?.length ?? 0;
    const visibleHeadings = [
      ...main.querySelectorAll<HTMLElement>("h1, h2"),
    ].filter((heading) => heading.checkVisibility());
    const headingRegions = new Set(
      visibleHeadings
        .map((heading) => heading.closest("section, form, article, aside"))
        .filter(Boolean),
    );
    const disclosureElements = [
      ...main.querySelectorAll<HTMLDetailsElement>(
        "details[data-product-mobile-disclosure], " +
          "details[data-seo-landing-disclosure], " +
          "details[data-mobile-content-disclosure]",
      ),
    ];
    const disclosureIds = disclosureElements.map(
      (details) =>
        details.dataset.productMobileDisclosure ??
        details.dataset.seoLandingDisclosure ??
        details.dataset.mobileContentDisclosure ??
        "",
    );
    const galleryImages = [
      ...main.querySelectorAll<HTMLImageElement>(
        "[data-responsive-gallery] img",
      ),
    ];
    const heroImage = main.querySelector<HTMLImageElement>("section img");
    const measuredWindow = window as typeof window & {
      __phaseThreeCls?: number;
    };
    const finalEnquiry = main.querySelector(
      "#project-details, .acrylic-section--estimate",
    );
    const firstLayerRoots = [...main.children].filter(
      (child) =>
        !child.matches("script, style, noscript") &&
        (!finalEnquiry ||
          Boolean(
            child.compareDocumentPosition(finalEnquiry) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          )),
    );
    const firstLayerCopy = firstLayerRoots
      .flatMap((root) => {
        const copy: string[] = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();
        while (current) {
          const parent = current.parentElement;
          const closedDisclosure = parent?.closest("details:not([open])");
          if (
            parent?.checkVisibility() &&
            (!closedDisclosure || parent.closest("summary"))
          ) {
            copy.push(current.textContent ?? "");
          }
          current = walker.nextNode();
        }
        return copy;
      })
      .join(" ");
    const childMajorSections = [...main.children]
      .filter((child) => child.matches("section, details"))
      .filter(
        (child) =>
          !finalEnquiry ||
          Boolean(
            child.compareDocumentPosition(finalEnquiry) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      ).length;
    const serviceMajorSections = main.querySelectorAll(
      "[data-service-major-section]",
    ).length;
    const mainBounds = main.getBoundingClientRect();

    return {
      cls: Number((measuredWindow.__phaseThreeCls ?? 0).toFixed(4)),
      directMajorChildren: main.querySelectorAll(
        ":scope > section, :scope > details, :scope > form",
      ).length,
      disclosureIds,
      documentHeight: Math.round(
        Math.max(
          document.documentElement.scrollHeight,
          mainBounds.bottom + window.scrollY,
        ),
      ),
      documentWidth: document.documentElement.scrollWidth,
      domNodes: document.querySelectorAll("*").length,
      firstLayerWords: wordCount(firstLayerCopy),
      galleryImageElements: galleryImages.length,
      galleryUniqueImageSources: new Set(
        galleryImages.map((image) => image.currentSrc || image.src),
      ).size,
      headingRegions: headingRegions.size,
      heroFetchPriority: heroImage?.getAttribute("fetchpriority") ?? null,
      heroLoading: heroImage?.getAttribute("loading") ?? null,
      mainHeight: Math.round(mainBounds.height),
      majorSectionsBeforeFinal: serviceMajorSections || childMajorSections,
      responsiveGalleries: main.querySelectorAll("[data-responsive-gallery]")
        .length,
      visibleWords: Math.max(
        0,
        wordCount((main as HTMLElement).innerText) -
          [...main.querySelectorAll<HTMLElement>(".visually-hidden")]
            .filter((node) => node.checkVisibility())
            .reduce((total, node) => total + wordCount(node.innerText), 0),
      ),
    };
  });
}

async function measureExpandedFirstLayerWords(page: Page) {
  const disclosures = page.locator(
    "main:visible details[data-product-mobile-disclosure], " +
      "main:visible details[data-seo-landing-disclosure], " +
      "main:visible details[data-mobile-content-disclosure]",
  );
  const initialStates = await disclosures.evaluateAll((items) =>
    items.map((item) => (item as HTMLDetailsElement).open),
  );

  try {
    await disclosures.evaluateAll((items) => {
      for (const item of items) {
        (item as HTMLDetailsElement).open = true;
      }
    });
    return (await measurePage(page)).firstLayerWords;
  } finally {
    await disclosures.evaluateAll((items, states) => {
      items.forEach((item, index) => {
        (item as HTMLDetailsElement).open = states[index] ?? false;
      });
    }, initialStates);
  }
}

function expectProductDetailMetrics(
  route: string,
  metrics: PageMetrics,
  imageRequestUrls: string[],
) {
  expect(metrics.disclosureIds, `${route} disclosure contract`).toEqual([
    "fit-and-definition",
    "specification-and-tradeoffs",
    "related-support",
  ]);
  expect(metrics.responsiveGalleries, `${route} gallery count`).toBe(1);
  expect(metrics.galleryImageElements, `${route} gallery image DOM`).toBe(1);
  expect(metrics.galleryUniqueImageSources, `${route} gallery inventory`).toBe(
    1,
  );
  expect(
    metrics.visibleWords,
    `${route} mobile copy budget`,
  ).toBeLessThanOrEqual(650);
  expect(metrics.cls, `${route} cumulative layout shift`).toBeLessThanOrEqual(
    0.1,
  );
  expect(metrics.heroFetchPriority, `${route} hero priority`).toBe("high");
  expect(
    new Set(imageRequestUrls).size,
    `${route} duplicate image requests`,
  ).toBe(imageRequestUrls.length);
}

test("all ten product details keep the consolidated payload and image contract", async ({
  baseURL,
  browser,
}) => {
  test.slow();
  expect(baseURL).toBeTruthy();

  for (const product of products) {
    const { context, page } = await createMeasuredPage(
      browser,
      String(baseURL),
      targetViewports[1],
    );
    const imageRequestUrls: string[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "image" && response.ok()) {
        imageRequestUrls.push(response.url());
      }
    });

    try {
      const response = await page.goto(product.route, {
        waitUntil: "networkidle",
      });
      expect(response?.ok(), `${product.route} should resolve`).toBe(true);
      await warmFullPage(page);
      const metrics = await measurePage(page);
      expectProductDetailMetrics(product.route, metrics, imageRequestUrls);
      expect(
        (await response!.body()).byteLength,
        `${product.route} HTML payload`,
      ).toBeLessThan(125_000);
      expect(metrics.documentWidth).toBeLessThanOrEqual(390);
    } finally {
      await context.close();
    }
  }
});

test("capture reproducible Phase 3 route measurements and screenshots", async ({
  baseURL,
  browser,
}) => {
  test.skip(
    !captureEnabled,
    "Set MARKETING_PHASE_THREE_CAPTURE=1 to capture Phase 3 evidence.",
  );
  test.slow();
  expect(baseURL).toBeTruthy();
  await mkdir(evidenceDirectory, { recursive: true });
  const records: Array<Record<string, unknown>> = [];

  for (const viewport of targetViewports) {
    for (const route of phaseThreeRoutes) {
      const { context, page } = await createMeasuredPage(
        browser,
        String(baseURL),
        viewport,
      );
      const imageRequestUrls: string[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "image" && response.ok()) {
          imageRequestUrls.push(response.url());
        }
      });

      try {
        const response = await page.goto(route, { waitUntil: "networkidle" });
        expect(response?.ok(), `${route} should resolve`).toBe(true);
        await warmFullPage(page);
        const metrics = await measurePage(page);
        expect(metrics.documentWidth).toBeLessThanOrEqual(viewport.width);
        expect(
          metrics.cls,
          `${route} CLS at ${viewport.width}px`,
        ).toBeLessThanOrEqual(0.1);

        if (route.startsWith("/products/")) {
          expectProductDetailMetrics(route, metrics, imageRequestUrls);
        }

        const transferredImageBytes = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((entry) => entry.initiatorType === "img")
            .reduce(
              (total, entry) =>
                total + (entry as PerformanceResourceTiming).transferSize,
              0,
            ),
        );
        const initialImageRequests = [...imageRequestUrls];
        const expandedFirstLayerWords =
          await measureExpandedFirstLayerWords(page);

        records.push({
          route,
          ...viewport,
          htmlBytes: (await response!.body()).byteLength,
          imageRequests: initialImageRequests.length,
          uniqueImageRequests: new Set(initialImageRequests).size,
          transferredImageBytes,
          expandedFirstLayerWords,
          ...metrics,
        });

        if (screenshotRoutes.has(route)) {
          const slug = route.slice(1).replaceAll("/", "--") || "home";
          await page.screenshot({
            path: resolve(
              evidenceDirectory,
              `${slug}-${viewport.width}-top.png`,
            ),
            fullPage: false,
          });
          if (viewport.width === 390) {
            if (
              serviceRoutes.includes(route as (typeof serviceRoutes)[number])
            ) {
              const evidence = page.locator(
                route === "/pergolas-auckland"
                  ? "#project-evidence"
                  : "#custom-project-evidence",
              );
              await evidence.scrollIntoViewIfNeeded();
              await page.screenshot({
                path: resolve(evidenceDirectory, `${slug}-390-evidence.png`),
                fullPage: false,
              });
            } else {
              await page.screenshot({
                path: resolve(evidenceDirectory, `${slug}-390-full.png`),
                fullPage: true,
              });
            }
          }
        }
      } finally {
        await context.close();
      }
    }
  }

  await writeFile(
    resolve(evidenceDirectory, "route-measurements.json"),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        origin: new URL(String(baseURL)).origin,
        production: new URL(String(baseURL)).origin === publicOrigin,
        records,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
});
