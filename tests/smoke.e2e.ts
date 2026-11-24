import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Deterministic smoke suite — no model, no network. Safe for CI.
// Run against an empty SENTINEL_DATA_DIR so the empty state is deterministic.
test('dashboard renders empty state', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('text=No incidents yet')).toBeVisible();
});

test('chat panel is rendered', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('.chat')).toBeVisible();
  await expect(browser.locator('.copilot, [class*="copilot"]').first()).toBeVisible();
});

test('header shows the night-shift brand', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('.brand-name')).toBeVisible();
});
