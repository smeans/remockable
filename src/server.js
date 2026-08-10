import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { resolve } from './resolver.js';
import { contentTypeFor } from './mime.js';

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`${status} ${message}\n`);
}

async function handleRequest(root, req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    sendError(res, 400, 'Bad Request');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendError(res, 400, 'Bad Request');
    return;
  }

  const queryPairs = [...url.searchParams.entries()];

  let filePath;
  try {
    filePath = await resolve(root, req.method, pathname, queryPairs);
  } catch {
    sendError(res, 500, 'Internal Server Error');
    return;
  }

  if (!filePath) {
    sendError(res, 404, 'Not Found');
    return;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    sendError(res, 404, 'Not Found');
    return;
  }

  const headers = {
    'Content-Type': contentTypeFor(filePath),
    'Content-Length': stat.size,
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  res.writeHead(200, headers);
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) sendError(res, 500, 'Internal Server Error');
    else res.destroy();
  });
  stream.pipe(res);
}

/**
 * Create (but do not start) the mock HTTP server.
 * @param {object} options
 * @param {string} options.root mocks root directory
 * @returns {import('node:http').Server}
 */
export function createServer({ root }) {
  const absoluteRoot = path.resolve(root);
  return http.createServer((req, res) => {
    handleRequest(absoluteRoot, req, res).catch(() => {
      if (!res.headersSent) sendError(res, 500, 'Internal Server Error');
      else res.destroy();
    });
  });
}

/**
 * Start the mock server listening on the given host/port.
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer({ root, port, host }) {
  const server = createServer({ root });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolvePromise(server);
    });
  });
}
