import { expect, test, type Page } from "@playwright/test";

const FIXTURE_PATH = "/qa/project-command-centre-fixture";
const VIEWPORTS = [
  [1600, 1000],
  [1440, 1000],
  [1280, 800],
  [1024, 900],
  [768, 1024],
  [390, 844],
] as const;

const JOURNEY_SCENARIOS = [
  {
    work: "v2-contacted-site-visit",
    action: "Arrange site visit",
    href: "/staff/schedule?view=site-visits&project=proj_fixture",
    recordsCompletion: false,
  },
  {
    work: "v2-site-visit",
    action: "Book or confirm site visit",
    href: "/staff/schedule?view=site-visits&project=proj_fixture",
    recordsCompletion: true,
  },
  {
    work: "v2-quoting",
    action: "Create draft quote",
    href: "/staff/projects/proj_fixture?tab=quotes&createFromEstimateId=est_fixture_1",
    recordsCompletion: false,
  },
] as const;

function fixtureUrl(work: string) {
  return `${FIXTURE_PATH}?scenario=standard-estimate&work=${work}&state=ready`;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
}

async function expectJourneyActions(page: Page) {
  for (const scenario of JOURNEY_SCENARIOS) {
    await page.goto(fixtureUrl(scenario.work));
    const projectWork = page.locator('[data-project-work-section="true"]');
    await expect(
      projectWork.getByRole("link", { name: scenario.action }),
    ).toHaveAttribute("href", scenario.href);
    await expect(
      projectWork.getByText("Open next step", { exact: true }),
    ).toHaveCount(0);
    await expect(
      projectWork.getByRole("button", { name: "Record visit complete" }),
    ).toHaveCount(scenario.recordsCompletion ? 1 : 0);
    await expectNoDocumentOverflow(page);
  }
}

for (const [width, height] of VIEWPORTS) {
  test(`keeps server-owned journey actions explicit at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await expectJourneyActions(page);
  });
}

test("keeps journey actions usable at the effective 640 CSS-pixel zoom viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 500 });
  await expectJourneyActions(page);
});
