const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_CONFIG_BYTES = 1024 * 1024;

function getConfigPath() {
  const directory = process.env.DAILY_REVIEW_CONFIG_DIR
    ? path.resolve(process.env.DAILY_REVIEW_CONFIG_DIR)
    : path.join(os.homedir(), '.daily-review');
  return path.join(directory, 'settings.json');
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function handleLocalConfigRequest(request, response, pathname) {
  if (pathname !== '/api/local-config') return false;

  if (request.method === 'GET') {
    fs.readFile(getConfigPath(), 'utf8', (error, content) => {
      if (error && error.code === 'ENOENT') {
        sendJson(response, 200, { config: null });
        return;
      }
      if (error) {
        sendJson(response, 500, { error: '无法读取本机配置' });
        return;
      }
      try {
        sendJson(response, 200, { config: JSON.parse(content) });
      } catch {
        sendJson(response, 500, { error: '本机配置文件格式无效' });
      }
    });
    return true;
  }

  if (request.method === 'POST') {
    const requestOrigin = request.headers.origin;
    const expectedOrigin = `http://${request.headers.host}`;
    if (requestOrigin && requestOrigin !== expectedOrigin) {
      sendJson(response, 403, { error: '拒绝跨站配置写入' });
      return true;
    }
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_CONFIG_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) {
        sendJson(response, 413, { error: '配置文件过大' });
        return;
      }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || !value.overallSituation) {
          throw new Error('invalid config');
        }
        const configPath = getConfigPath();
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
        sendJson(response, 200, { saved: true });
      } catch {
        sendJson(response, 400, { error: '配置内容无效' });
      }
    });
    return true;
  }

  response.writeHead(405, { Allow: 'GET, POST' }).end('Method not allowed');
  return true;
}

module.exports = { getConfigPath, handleLocalConfigRequest };
