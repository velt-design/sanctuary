import { expect, test } from "@playwright/test";

import {
  getPortalScenarioState,
  loadPortalScenarioState,
} from "./support/portalScenarioRegistry";

type QuoteLineItem = {
  description: string;
  qty: number;
  unitPriceIncGstCents: number;
};

type QuoteDetail = {
  id: string;
  status: string;
  commercialRevision: number;
  commercialWorkflowReady?: boolean;
  isCurrentDraft: boolean;
  deliveryPreparedAt: string | null;
  reference: string | null;
  introText: string | null;
  termsText: string | null;
  depositPercent: number;
  expiresAt: string | null;
  lineItems: QuoteLineItem[];
};

test.describe.configure({ mode: "serial" });
test.use({
  storageState: { cookies: [], origins: [] },
  screenshot: "off",
  trace: "off",
  video: "off",
});

test("staging migration enables quote reads and revision-safe draft commands without delivery", async ({
  page,
}) => {
  test.setTimeout(180_000);

  expect(
    process.env.PORTAL_COMMERCIAL_STAGING_MUTATIONS,
    "This mutation smoke is restricted to an explicitly provisioned staging target.",
  ).toBe("1");

  const state = loadPortalScenarioState();
  expect(state.target).toBe("staging");
  expect(state.prefix).toBe("commercialqa");
  const scenario = getPortalScenarioState(state, "quote-ready");
  expect(scenario.quoteVersionId).toBeTruthy();

  const email = process.env.PORTAL_TEST_EMAIL?.trim();
  const password = process.env.PORTAL_TEST_PASSWORD?.trim();
  expect(email, "The staging test email must be set.").toBeTruthy();
  expect(password, "The staging test password must be set.").toBeTruthy();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Staff Login" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(email!);
  const passwordField = page.getByRole("textbox", { name: "Password" });
  await passwordField.fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).some((cookie) =>
            cookie.name.includes("-auth-token"),
          ),
        {
          message: "Staging authentication did not establish a session cookie.",
          timeout: 60_000,
        },
      )
      .toBe(true);
  } finally {
    await passwordField.fill("").catch(() => {});
  }

  const quoteVersionId = scenario.quoteVersionId!;
  const quoteRoute =
    `/staff/projects/${scenario.projectId}` +
    `?tab=quotes&quoteId=${quoteVersionId}`;

  const initialResponse = await page.request.get(
    `/api/quotes/${quoteVersionId}`,
  );
  expect(initialResponse.status()).toBe(200);
  const initialPayload = (await initialResponse.json()) as {
    quoteVersion: QuoteDetail;
  };
  const initial = initialPayload.quoteVersion;
  expect(initial.status).toBe("DRAFT");
  expect(initial.commercialWorkflowReady).toBe(true);
  expect(initial.isCurrentDraft).toBe(true);
  expect(initial.deliveryPreparedAt).toBeNull();
  expect(initial.commercialRevision).toBeGreaterThanOrEqual(1);
  expect(initial.lineItems.length).toBeGreaterThan(0);

  const reference = "[Staging QA] Commercial migration verified";
  const patch = {
    reference,
    introText: initial.introText,
    termsText: initial.termsText,
    depositPercent: initial.depositPercent,
    expiresAt: initial.expiresAt,
    lineItems: initial.lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
    })),
    expectedCommercialRevision: initial.commercialRevision,
  };

  const updateResponse = await page.request.patch(
    `/api/quotes/${quoteVersionId}`,
    {
      data: patch,
    },
  );
  expect(updateResponse.status()).toBe(200);
  const updatePayload = (await updateResponse.json()) as {
    quoteVersion: QuoteDetail;
  };
  expect(updatePayload.quoteVersion.reference).toBe(reference);
  expect(updatePayload.quoteVersion.commercialRevision).toBe(
    initial.commercialRevision + 1,
  );

  const staleResponse = await page.request.patch(
    `/api/quotes/${quoteVersionId}`,
    {
      data: patch,
    },
  );
  expect(staleResponse.status()).toBe(409);
  await expect(staleResponse.json()).resolves.toMatchObject({
    code: "QUOTE_STALE",
  });

  const recoveryResponse = await page.request.get(
    `/api/quotes/${quoteVersionId}/prepared-delivery?mode=send`,
  );
  expect(recoveryResponse.status()).toBe(404);
  await expect(recoveryResponse.json()).resolves.toMatchObject({
    error: "No prepared delivery found",
  });

  const finalResponse = await page.request.get(`/api/quotes/${quoteVersionId}`);
  expect(finalResponse.status()).toBe(200);
  const finalPayload = (await finalResponse.json()) as {
    quoteVersion: QuoteDetail;
  };
  expect(finalPayload.quoteVersion.reference).toBe(reference);
  expect(finalPayload.quoteVersion.commercialRevision).toBe(
    initial.commercialRevision + 1,
  );
  expect(finalPayload.quoteVersion.commercialWorkflowReady).toBe(true);

  await page.goto(quoteRoute);
  await expect(page).not.toHaveURL(/\/login|\/access-status/);
  await expect(page.getByPlaceholder("Optional reference")).toHaveValue(
    reference,
    { timeout: 60_000 },
  );
  await expect(
    page.getByText("Commercial actions are temporarily unavailable"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /review.*send/i })).toBeEnabled(
    { timeout: 60_000 },
  );
});
