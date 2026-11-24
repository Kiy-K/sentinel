import { beforeEach, describe, test } from '@e2e-dev/web';

// Real-user pass over the deployed Sentinel dashboard. Point APP_URL at the
// target (defaults to the config's localhost). Read-only: never clicks merge.
describe('sentinel dashboard (live)', () => {
  beforeEach(async ({ app }) => {
    await app.open('/');
  });

  test('a visitor sees the incident list with the demo incident', async ({ agent }) => {
    await agent.assert(
      'this is the Sentinel Night Shift dashboard and it lists at least one incident for a Kiy-K repository (e.g. Kiy-K/night-shift-demo or Kiy-K/sentinel-demo)',
    );
    await agent.assert('the listed incident shows a status such as fixed, failed or skipped');
  });

  test('selecting the incident shows evidence and a PR link', async ({ agent }) => {
    await agent.act('click the incident card whose status badge reads fixed');
    await agent.assert('the detail panel shows the failing workflow or commit SHA for the incident');
    await agent.assert('the detail panel shows a link to a pull request on github.com');
  });
});
