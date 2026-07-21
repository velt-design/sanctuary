import { expect, test } from '@playwright/test';
import {
  commandCentreActionFixtures,
  commandCentreFixtures,
} from '../apps/portal/app/qa/project-command-centre-fixture/fixtures';

const FIXTURE_PATH = '/qa/project-command-centre-fixture';
const PROJECT_SHELL_FIXTURE_PATH = '/qa/project-page-shell-fixture';

const SCENARIOS = [
  ['new-lead', '$1,234.56 inc GST'],
  ['no-current-design', 'No current design'],
  ['standard-estimate', '$1,234.56 inc GST'],
  ['multiple-estimates', '6m x 4m + 2 more'],
  ['sent-revision', 'Quote sent'],
  ['accepted-newer-estimate', 'newer unrelated estimate'],
  ['declined-quote', 'Latest quote outcome: declined'],
  ['missing-source', 'Source design unavailable'],
  ['missing-price', 'Price unavailable'],
] as const;

for (const [scenario, expected] of SCENARIOS) {
  test(`renders truthful ${scenario} command-centre state`, async ({ page }) => {
    await page.goto(`${FIXTURE_PATH}?scenario=${scenario}`);
    const fixture = page.locator('[data-portal-qa-fixture="project-command-centre"]');
    await expect(fixture).toHaveAttribute('data-fixture-scenario', scenario);
    await expect(fixture).toContainText(expected);
    await expect(fixture.locator('[data-command-centre-source]')).toBeVisible();
  });
}

test('keeps the command-centre card readable at a 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FIXTURE_PATH}?scenario=accepted-newer-estimate`);
  const fixture = page.locator('[data-portal-qa-fixture="project-command-centre"]');
  await expect(fixture).toContainText('Quote accepted');
  await expect(fixture).toContainText('newer unrelated estimate');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
});

const ACTION_VIEWPORTS = [
  [1600, 900, 'primary', 'Finalise and send quote'],
  [1366, 768, 'critical', 'Customer cannot proceed'],
  [1024, 768, 'conflict', 'Primary-action review required'],
  [768, 900, 'undated', 'Due date required'],
  [390, 844, 'primary', 'Automation task'],
] as const;

for (const [width, height, actionScenario, expected] of ACTION_VIEWPORTS) {
  test(`renders the ${actionScenario} primary-action state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=${actionScenario}`);
    const fixture = page.locator('[data-portal-qa-fixture="project-command-centre"]');
    await expect(fixture).toHaveAttribute('data-action-scenario', actionScenario);
    await expect(fixture.locator('[data-primary-action-card="true"]')).toBeVisible();
    await expect(fixture).toContainText(expected);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
  });
}

test('confirms manual creation and completion pessimistically through the production action card', async ({ page }) => {
  const commands: Array<Record<string, unknown>> = [];
  await page.route('**/api/staff/v1/projects/proj_fixture/command-centre/primary-action/commands', async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    commands.push(command);
    const operations = command.command === 'complete'
      ? commandCentreActionFixtures.empty
      : commandCentreActionFixtures.primary;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        command: { id: command.commandId, committed: true },
        commandCentre: { projectId: 'proj_fixture', operations, generatedAt: new Date().toISOString() },
      }),
    });
  });

  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=empty`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage next action' }).click();
  await page.getByLabel('Action title').fill('Call the customer about access');
  await page.getByLabel('Due date', { exact: true }).fill('2026-07-22');
  await page.getByRole('button', { name: 'Create and select' }).click();
  await expect(page.getByRole('heading', { name: 'Finalise and send quote' })).toBeVisible();
  expect(commands[0]).toMatchObject({ command: 'create_manual', title: 'Call the customer about access', dueDate: '2026-07-22' });

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.locator('[data-primary-action-state="empty"]')).toBeVisible();
  expect(commands[1]).toMatchObject({ command: 'complete' });
});

test('keeps every manual-action field usable when the action card is narrow', async ({ page }) => {
  await page.setViewportSize({ width: 920, height: 900 });
  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=empty`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage next action' }).click();

  const titleInput = page.getByLabel('Action title');
  await expect(titleInput).toBeVisible();
  const titleBounds = await titleInput.boundingBox();
  expect(titleBounds?.width ?? 0).toBeGreaterThan(200);

  await titleInput.fill('Call the customer about access');
  await page.getByLabel('Due date', { exact: true }).fill('2026-07-23');
  await expect(page.getByRole('button', { name: 'Create and select' })).toBeEnabled();
});

test('submits reschedule, reassignment, criticality and undated selection commands', async ({ page }) => {
  const commands: Array<Record<string, unknown>> = [];
  await page.route('**/api/staff/v1/projects/proj_fixture/command-centre/primary-action/commands', async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    commands.push(command);
    const operations = command.command === 'set_critical'
      ? commandCentreActionFixtures.critical
      : commandCentreActionFixtures.primary;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        command: { id: command.commandId, committed: true },
        commandCentre: { projectId: 'proj_fixture', operations, generatedAt: new Date().toISOString() },
      }),
    });
  });

  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=primary`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage next action' }).click();
  await page.getByLabel('New due date').fill('2026-07-23');
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await page.getByLabel('Action owner').selectOption('00000000-0000-4000-8000-000000000002');
  await page.getByRole('button', { name: 'Reassign' }).click();
  await page.getByLabel('Criticality reason').fill('Customer decision is blocked');
  await page.getByRole('button', { name: 'Mark critical' }).click();
  await expect(page.getByText('Critical: Customer cannot proceed without a revised quote.')).toBeVisible();

  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=undated`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage next action' }).click();
  await page.getByLabel('Select open work').selectOption('automation_task:00000000-0000-4000-8000-000000000011');
  await page.getByLabel('Due date', { exact: true }).first().fill('2026-07-24');
  await page.getByRole('button', { name: 'Make primary' }).click();
  await expect(page.getByRole('heading', { name: 'Finalise and send quote' })).toBeVisible();

  expect(commands.map((command) => command.command)).toEqual(['reschedule', 'reassign', 'set_critical', 'select']);
  expect(commands[1]).toMatchObject({ ownerUserId: '00000000-0000-4000-8000-000000000002' });
  expect(commands[3]).toMatchObject({ dueDate: '2026-07-24' });
});

test('submits project-owner and admin conflict-resolution commands', async ({ page }) => {
  const ownerCommands: Array<Record<string, unknown>> = [];
  const actionCommands: Array<Record<string, unknown>> = [];
  await page.route('**/api/staff/v1/projects/proj_fixture/command-centre/owners', async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    ownerCommands.push(command);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        command: { id: command.commandId, committed: true },
        commandCentre: { projectId: 'proj_fixture', operations: commandCentreActionFixtures.admin, generatedAt: new Date().toISOString() },
      }),
    });
  });
  await page.route('**/api/staff/v1/projects/proj_fixture/command-centre/primary-action/commands', async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    actionCommands.push(command);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        command: { id: command.commandId, committed: true },
        commandCentre: { projectId: 'proj_fixture', operations: commandCentreActionFixtures.primary, generatedAt: new Date().toISOString() },
      }),
    });
  });

  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=admin`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage project owner' }).click();
  await page.getByLabel('Change project owner').selectOption('jp');
  await expect.poll(() => ownerCommands.length).toBe(1);
  expect(ownerCommands[0]).toMatchObject({ ownerKey: 'jp' });

  await page.goto(`${FIXTURE_PATH}?scenario=standard-estimate&action=admin-conflict`);
  await expect(page.locator('[data-command-centre-fixture-hydrated="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Use selected action' }).click();
  await expect(page.locator('[data-action-conflict="true"]')).toHaveCount(0);
  expect(actionCommands[0]).toMatchObject({ command: 'resolve_conflict', resolution: 'select_candidate' });
});

const PROJECT_SHELL_VIEWPORTS = [
  [1600, 900],
  [1366, 768],
  [1024, 768],
  [768, 900],
  [390, 844],
] as const;

for (const [width, height] of PROJECT_SHELL_VIEWPORTS) {
  test(`renders the full-width project shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/api/staff/v1/projects/proj_fixture_shell/command-centre', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          projectId: 'proj_fixture_shell',
          currentDesign: commandCentreFixtures['standard-estimate'],
          operations: commandCentreActionFixtures.primary,
          generatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`${PROJECT_SHELL_FIXTURE_PATH}?tab=activity&campaign=winter`);
    const fixture = page.locator('[data-portal-qa-fixture="project-page-shell"]');
    await expect(fixture).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aroha Smith - Takapuna' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible();
    await expect(page.locator('[data-project-status-details="true"]')).toContainText('Sent');
    await expect(page.locator('[data-primary-action-card="true"]')).toBeVisible();
    await expect(page.locator('[data-project-rail]')).toHaveCount(0);
    await expect(page.locator('[role="separator"]')).toHaveCount(0);

    const stickyPosition = await page.locator('[data-project-masthead-slot="fixed"]').evaluate(
      (element) => getComputedStyle(element).position,
    );
    expect(stickyPosition).toBe('sticky');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
  });
}

test('moves between header tabs while preserving unrelated project query parameters', async ({ page }) => {
  await page.route('**/api/staff/v1/projects/proj_fixture_shell/command-centre', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'proj_fixture_shell',
        currentDesign: null,
        operations: commandCentreActionFixtures.empty,
        generatedAt: new Date().toISOString(),
      }),
    });
  });
  await page.goto(`${PROJECT_SHELL_FIXTURE_PATH}?tab=activity&campaign=winter`);
  await page.getByRole('tab', { name: 'Emails' }).click();
  await expect(page).toHaveURL(/tab=emails/);
  await expect(page).toHaveURL(/campaign=winter/);
  await expect(page.getByRole('tab', { name: 'Emails' })).toHaveAttribute('aria-selected', 'true');
});
