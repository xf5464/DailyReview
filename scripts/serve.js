const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleLocalConfigRequest } = require('../desktop/local-config');

const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.DAILY_REVIEW_PORT || 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (handleLocalConfigRequest(request, response, pathname)) return;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(root, '.' + requested);
  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(content);
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write('DailyReview preview: http://127.0.0.1:' + port + '\n');
});
