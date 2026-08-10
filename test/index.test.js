import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProgram } from '../src/index.js';
import { resolve } from '../src/resolver.js';
import { contentTypeFor } from '../src/mime.js';
import { startServer } from '../src/server.js';

let root;

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'remockable-'));

  await fs.mkdir(path.join(root, 'posts'), { recursive: true });
  await fs.mkdir(path.join(root, 'posts', 'format', 'pdf'), { recursive: true });
  await fs.mkdir(path.join(root, 'images'), { recursive: true });
  await fs.mkdir(path.join(root, 'ambiguous'), { recursive: true });

  await fs.writeFile(path.join(root, 'index.html'), '<h1>home</h1>');
  await fs.writeFile(path.join(root, 'posts', 'index.json'), '["get"]');
  await fs.writeFile(path.join(root, 'posts', 'index.POST.json'), '{"created":true}');
  await fs.writeFile(path.join(root, 'posts', '1234.json'), '{"id":1234}');
  await fs.writeFile(path.join(root, 'posts', '1234.DELETE.json'), '{"deleted":true}');
  await fs.writeFile(path.join(root, 'posts', 'format', 'pdf', '1234.json'), '{"pdf":true}');
  await fs.writeFile(path.join(root, 'images', 'logo.png'), 'PNGDATA');
  await fs.writeFile(path.join(root, '.secret'), 'nope');

  await fs.mkdir(path.join(root, 'policy', '_doc'), { recursive: true });
  await fs.writeFile(path.join(root, 'policy', '_doc', 'index.md'), '# doc');

  // Two files differing only by extension -> ambiguous -> 404.
  await fs.writeFile(path.join(root, 'ambiguous', 'thing.json'), '{}');
  await fs.writeFile(path.join(root, 'ambiguous', 'thing.txt'), 'x');
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('buildProgram configures the CLI name and version', () => {
  const program = buildProgram();
  assert.equal(program.name(), 'remockable');
  assert.match(program.version(), /^\d+\.\d+\.\d+$/);
});

test('contentTypeFor maps known extensions', () => {
  assert.match(contentTypeFor('/x/logo.png'), /^image\/png/);
  assert.match(contentTypeFor('foo.json'), /^application\/json/);
  assert.equal(contentTypeFor('noext'), 'application/octet-stream');
});

test('resolves directory index for GET', async () => {
  const p = await resolve(root, 'GET', '/', []);
  assert.equal(p, path.join(root, 'index.html'));
});

test('resolves nested folder index for GET', async () => {
  const p = await resolve(root, 'GET', '/posts', []);
  assert.equal(p, path.join(root, 'posts', 'index.json'));
});

test('resolves verb-specific index for POST', async () => {
  const p = await resolve(root, 'POST', '/posts', []);
  assert.equal(p, path.join(root, 'posts', 'index.POST.json'));
});

test('resolves named resource for GET and DELETE', async () => {
  const get = await resolve(root, 'GET', '/posts/1234', []);
  assert.equal(get, path.join(root, 'posts', '1234.json'));

  const del = await resolve(root, 'DELETE', '/posts/1234', []);
  assert.equal(del, path.join(root, 'posts', '1234.DELETE.json'));
});

test('optional extension: request without extension resolves', async () => {
  const p = await resolve(root, 'GET', '/images/logo', []);
  assert.equal(p, path.join(root, 'images', 'logo.png'));
});

test('query parameters traverse the tree', async () => {
  const p = await resolve(root, 'GET', '/posts/1234', [['format', 'pdf']]);
  assert.equal(p, path.join(root, 'posts', 'format', 'pdf', '1234.json'));
});

test('valueless query flag traverses into a directory index', async () => {
  const p = await resolve(root, 'GET', '/policy', [['_doc', '']]);
  assert.equal(p, path.join(root, 'policy', '_doc', 'index.md'));
});

test('ambiguous extension yields 404', async () => {
  const p = await resolve(root, 'GET', '/ambiguous/thing', []);
  assert.equal(p, null);
});

test('missing resource yields 404', async () => {
  const p = await resolve(root, 'GET', '/nope', []);
  assert.equal(p, null);
});

test('hidden files are never served', async () => {
  const p = await resolve(root, 'GET', '/.secret', []);
  assert.equal(p, null);
});

test('path traversal is rejected', async () => {
  const p = await resolve(root, 'GET', '/../secret', []);
  assert.equal(p, null);
});

test('HEAD is treated like GET for resolution', async () => {
  const p = await resolve(root, 'HEAD', '/posts', []);
  assert.equal(p, path.join(root, 'posts', 'index.json'));
});

test('server serves resolved mock over HTTP', async () => {
  const server = await startServer({ root, port: 0, host: '127.0.0.1' });
  const { port } = server.address();
  try {
    const getRes = await fetch(`http://127.0.0.1:${port}/posts`);
    assert.equal(getRes.status, 200);
    assert.match(getRes.headers.get('content-type'), /application\/json/);
    assert.equal(await getRes.text(), '["get"]');

    const postRes = await fetch(`http://127.0.0.1:${port}/posts`, { method: 'POST' });
    assert.equal(postRes.status, 200);
    assert.equal(await postRes.text(), '{"created":true}');

    const missing = await fetch(`http://127.0.0.1:${port}/nope`);
    assert.equal(missing.status, 404);

    const pdf = await fetch(`http://127.0.0.1:${port}/posts/1234?format=pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(await pdf.text(), '{"pdf":true}');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
