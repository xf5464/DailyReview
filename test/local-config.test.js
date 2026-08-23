const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { getConfigPath, handleLocalConfigRequest } = require('../desktop/local-config');

test('local preview config API persists one shared settings file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-config-'));
  const previousDirectory = process.env.DAILY_REVIEW_CONFIG_DIR;
  process.env.DAILY_REVIEW_CONFIG_DIR = directory;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!handleLocalConfigRequest(request, response, pathname)) response.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const emptyResponse = await fetch(origin + '/api/local-config');
    assert.deepEqual(await emptyResponse.json(), { config: null });

    const config = {
      overallSituation: { groups: [{ id: 'default', name: '默认' }] },
      displayControls: { chartLineWidth: 2 },
    };
    const saveResponse = await fetch(origin + '/api/local-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    assert.equal(saveResponse.status, 200);
    assert.deepEqual(JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')), config);

    const blockedResponse = await fetch(origin + '/api/local-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
      body: JSON.stringify(config),
    });
    assert.equal(blockedResponse.status, 403);

    const loadedResponse = await fetch(origin + '/api/local-config');
    assert.deepEqual(await loadedResponse.json(), { config });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousDirectory === undefined) delete process.env.DAILY_REVIEW_CONFIG_DIR;
    else process.env.DAILY_REVIEW_CONFIG_DIR = previousDirectory;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
