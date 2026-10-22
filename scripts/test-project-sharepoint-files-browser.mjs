import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildSyntheticOpenHandler, files } from './lib/sharepoint-browser-fixtures.mjs';
// Isolated synthetic component harness. Never uses the owner's browser/profile or real files.
const output = path.resolve('test-results/sharepoint-files');
await mkdir(output, { recursive: true });
const built = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import Panel from './apps/portal/components/projects/ProjectPage/tabs/overview/ProjectSharePointFilesPanel'; import './apps/portal/app/globals.css'; import './apps/portal/components/ui/foundation/foundation.tokens.css'; const client=new QueryClient(); createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Panel projectId="proj_fixture" host="synthetic" /></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, outfile: path.join(output, 'fixture.js'), alias: { '@': path.resolve('apps/portal') }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'synthetic-link', setup(build) { build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'next/link', namespace: 'synthetic-link' })); build.onLoad({ filter: /.*/, namespace: 'synthetic-link' }, () => ({ contents: `import React from 'react';export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}`, loader: 'jsx', resolveDir: process.cwd() })); } }],
});
const rootId = '11111111-1111-4111-8111-111111111111';
const openFile = await buildSyntheticOpenHandler();
let fail = false, failOpen = false, origin;
const providerRequests = [];
globalThis.__sharePointHarnessGraph = async (_db, projectId, selectedRoot) => {
  assert.equal(projectId, 'proj_fixture'); assert.equal(selectedRoot, rootId);
  return { root: { itemId: 'root' }, graph: { async download(root, id) {
    assert.equal(root, 'root');
    if (failOpen) { failOpen = false; throw new Error('Synthetic transient action failure'); }
    const file = files[id]; if (!file) throw new Error('Unknown fixture');
    return { item: { name: file.name, size: file.bytes.length, file: { mimeType: file.mime } }, url: `${origin}/synthetic-provider/${id}` };
  } } };
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const opened = url.pathname.match(/^\/api\/staff\/v1\/projects\/([^/]+)\/files\/([^/]+)\/open$/);
  if (opened) {
    const result = await openFile(new Request(origin + request.url, { headers: request.headers }), { params: Promise.resolve({ projectId: opened[1], itemId: opened[2] }) });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) Readable.fromWeb(result.body).pipe(response); else response.end();
    return;
  }
  if (url.pathname.startsWith('/synthetic-provider/')) {
    const id = url.pathname.split('/').at(-1), file = files[id];
    providerRequests.push({ id, authorization: request.headers.authorization });
    if (!file) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': file.mime, 'content-length': file.bytes.length, 'content-disposition': `${id === 'rhino' ? 'attachment' : 'inline'}; filename="${file.name}"`, 'cache-control': 'no-store' });
    response.end(file.bytes); return;
  }
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('content-type', 'application/json');
    if (fail) { fail = false; response.writeHead(503); response.end('{}'); return; }
    const folder = url.searchParams.get('folderId');
    const root = url.searchParams.get('rootId') ?? rootId;
    response.end(JSON.stringify({ state: 'ready', roots: [{ id: rootId, itemId: 'root', label: 'Current project' }, { id: '22222222-2222-4222-8222-222222222222', itemId: 'other', label: 'Earlier enquiry' }], rootId: root, folderId: folder ?? 'root', cursor: null,
      items: folder ? Object.entries(files).map(([id, file]) => ({ id, name: file.name, kind: 'file', size: id === 'rhino' ? 470000000 : file.bytes.length, viewable: id !== 'rhino' })) : [{ id: 'cad', name: '3 CAD', kind: 'folder', size: 0, viewable: false }] })); return;
  }
  if (['/fixture.js', '/fixture.css'].includes(url.pathname)) { response.setHeader('content-type', url.pathname.endsWith('js') ? 'application/javascript' : 'text/css'); response.end(built.outputFiles.find(file => path.basename(file.path) === url.pathname.slice(1)).contents); return; }
  response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>:root{--font-inter:Arial}body{font-family:var(--ui-font-body)}</style></head><body><main id="root" style="max-width:1000px;margin:auto;padding:16px"></main><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: '3 CAD', exact: true }).click();
  await page.getByText('Original design.3dm').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Download', exact: true }).count(), 3);
  assert.equal(await page.getByRole('link', { name: 'View', exact: true }).count(), 2);
  const photoView = page.getByRole('row').filter({ hasText: 'Site photo.png' }).getByRole('link', { name: 'View', exact: true });
  failOpen = true;
  const [failedPreview] = await Promise.all([page.waitForEvent('popup'), photoView.click()]);
  await failedPreview.getByText('Project files are temporarily unavailable.', { exact: false }).waitFor();
  await failedPreview.close();
  const [photoPreview] = await Promise.all([page.waitForEvent('popup'), photoView.click()]);
  await photoPreview.waitForFunction(() => { const image = document.querySelector('img'); return image?.complete && image.naturalWidth === 1 && image.naturalHeight === 1; });
  await photoPreview.screenshot({ path: path.join(output, 'photo-preview.png') });
  await photoPreview.close();
  const originalLink = page.getByRole('row').filter({ hasText: 'Original design.3dm' }).getByRole('link', { name: 'Download', exact: true });
  const [original] = await Promise.all([page.waitForEvent('download'), originalLink.click()]);
  assert.equal(original.suggestedFilename(), files.rhino.name);
  assert.equal(await original.failure(), null);
  const received = await readFile(await original.path());
  assert.deepEqual(received, files.rhino.bytes);
  const sha256 = value => createHash('sha256').update(value).digest('hex');
  assert.equal(sha256(received), sha256(files.rhino.bytes));
  // Verify real PDF route bytes/headers separately; no claim of native PDF viewer acceptance.
  const pdf = await page.request.get(`${origin}/api/staff/v1/projects/proj_fixture/files/pdf/open?rootId=${rootId}&mode=view`);
  assert.equal(pdf.status(), 200); assert.equal(pdf.headers()['content-type'], 'application/pdf');
  assert.deepEqual(await pdf.body(), files.pdf.bytes);
  assert.ok(providerRequests.some(request => request.id === 'photo'));
  assert.ok(providerRequests.some(request => request.id === 'rhino'));
  assert.ok(providerRequests.every(request => request.authorization === undefined));
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page overflows mobile viewport');
  const download = await page.getByRole('link', { name: 'Download', exact: true }).first().boundingBox();
  assert.ok(download && download.x >= 0 && download.x + download.width <= 390, 'Mobile download is outside the visible viewport');
  await page.getByRole('button', { name: 'Back to project folder' }).click();
  await page.getByRole('button', { name: '3 CAD', exact: true }).waitFor();
  await page.getByLabel('Project folder').selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: '3 CAD', exact: true }).waitFor();
  fail = true; await page.getByRole('button', { name: 'Refresh files' }).click();
  await page.getByText('SharePoint files could not be loaded').waitFor();
  await page.getByRole('button', { name: /retry/i }).click();
  await page.getByRole('button', { name: '3 CAD', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: isolated desktop/mobile browsing; actual View click renders a PNG after failed-action retry; actual Download click preserves synthetic original filename/bytes/hash; real open-handler PDF bytes/headers; navigation/return and list retry. Auth/Graph boundaries are synthetic. No real SharePoint, valid Rhino document or native PDF viewer acceptance claimed.');
} finally { delete globalThis.__sharePointHarnessGraph; await browser?.close(); await new Promise(resolve => server.close(resolve)); }
