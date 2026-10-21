import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
// Isolated synthetic component harness. Never uses the owner's browser/profile or real files.
const output = path.resolve('test-results/sharepoint-files');
await mkdir(output, { recursive: true });
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import Panel from './apps/portal/components/projects/ProjectPage/tabs/overview/ProjectSharePointFilesPanel'; import './apps/portal/app/globals.css'; import './apps/portal/components/ui/foundation/foundation.tokens.css'; const client=new QueryClient(); createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Panel projectId="proj_fixture" host="synthetic" /></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, outfile: path.join(output, 'fixture.js'), alias: { '@': path.resolve('apps/portal') }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'synthetic-link', setup(build) { build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'next/link', namespace: 'synthetic-link' })); build.onLoad({ filter: /.*/, namespace: 'synthetic-link' }, () => ({ contents: `import React from 'react';export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}`, loader: 'jsx', resolveDir: process.cwd() })); } }],
});
const rootId = '11111111-1111-4111-8111-111111111111';
let fail = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('content-type', 'application/json');
    if (fail) { fail = false; response.writeHead(503); response.end('{}'); return; }
    const folder = url.searchParams.get('folderId');
    const root = url.searchParams.get('rootId') ?? rootId;
    response.end(JSON.stringify({ state: 'ready', roots: [{ id: rootId, itemId: 'root', label: 'Current project' }, { id: '22222222-2222-4222-8222-222222222222', itemId: 'other', label: 'Earlier enquiry' }], rootId: root, folderId: folder ?? 'root', cursor: null,
      items: folder ? [{ id: 'rhino', name: 'Original design.3dm', kind: 'file', size: 470000000, viewable: false }, { id: 'pdf', name: 'Design.pdf', kind: 'file', size: 2000, viewable: true }] : [{ id: 'cad', name: '3 CAD', kind: 'folder', size: 0, viewable: false }] })); return;
  }
  if (['/fixture.js', '/fixture.css'].includes(url.pathname)) { response.setHeader('content-type', url.pathname.endsWith('js') ? 'application/javascript' : 'text/css'); response.end(await readFile(path.join(output, url.pathname.slice(1)))); return; }
  response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>:root{--font-inter:Arial}body{font-family:var(--ui-font-body)}</style></head><body><main id="root" style="max-width:1000px;margin:auto;padding:16px"></main><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: '3 CAD', exact: true }).click();
  await page.getByText('Original design.3dm').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Download', exact: true }).count(), 2);
  assert.equal(await page.getByRole('link', { name: 'View', exact: true }).count(), 1);
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
  console.log('PASS: isolated desktop/mobile Files component, CAD navigation/return, PDF/Rhino actions, root selection and failure/retry. No real provider or Portal session used.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
