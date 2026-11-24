import { beforeEach, describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Real-user pass over the deployed Sentinel dashboard. Point APP_URL at the
// target (defaults to the config's localhost). Read-only: never clicks merge.
describe('sentinel dashboard (live)', () => {
  beforeEach(async ({ app }) => {
    await app.open('/');
  });

  test('a visitor sees the incident list with the demo incident', async ({ agent }) => {
    await agent.assert(
      'this is the Sentinel night-shift dashboard and it lists at least one incident whose repository is Kiy-K/sentinel-demo',
    );
    await agent.assert('the listed incident shows a status such as fixed, failed or skipped');
  });

  test('opening the incident shows evidence and a PR link', async ({ agent, browser }) => {
    await agent.act('open the incident for Kiy-K/sentinel-demo by clicking its row or link');
    await expect(browser).toHaveURL(/incident/);
    await agent.assert('the detail page shows the failing workflow or commit SHA for the incident');
    await agent.assert('the detail page shows a link to a pull request on github.com');
  });
});
