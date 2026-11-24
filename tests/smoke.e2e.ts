import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Deterministic smoke suite — no model, no network. Safe for CI.
// Agent/live tests live in live-dashboard.e2e.ts and need ChatGPT OAuth.
// Run against an empty SENTINEL_DATA_DIR so the empty state is deterministic.
test('dashboard renders empty state', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('text=No incidents recorded yet.')).toBeVisible();
});

test('unknown incident id renders a 404 page', async ({ app, browser }) => {
  await app.open('/incidents/does-not-exist');
  await expect(browser.locator('text=No incident')).toBeVisible();
});

test('brand link points home', async ({ app, browser }) => {
  await app.open('/incidents/does-not-exist');
  await expect(browser.locator('header a.brand')).toBeVisible();
});
