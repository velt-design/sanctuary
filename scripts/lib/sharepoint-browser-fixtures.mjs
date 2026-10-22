import { build } from 'esbuild';
import path from 'node:path';

function onePagePdf() {
  const stream = 'BT /F1 14 Tf 40 100 Td (Synthetic preview fixture) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let text = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(text + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
export const files = {
  photo: { name: 'Site photo.png', mime: 'image/png', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4S8AAAAASUVORK5CYII=', 'base64') },
  pdf: { name: 'Design.pdf', mime: 'application/pdf', bytes: onePagePdf() },
  // Deliberately synthetic transport bytes, not a valid Rhino document.
  rhino: { name: 'Original design.3dm', mime: 'application/octet-stream', bytes: Buffer.concat([Buffer.from('SYNTHETIC ORIGINAL DOWNLOAD FIXTURE\n'), Buffer.from([0, 1, 2, 127, 128, 254, 255])]) },
};

export async function buildSyntheticOpenHandler() {
  const mocks = {
    '@/lib/supabase/serverClient': 'export async function getSupabaseServerAuth(){return {auth:{async getUser(){return {data:{user:{id:"synthetic-user"}},error:null}}}}}',
    '@/lib/api/routeDiagnostics': 'export function createRouteDiagnostics(){return {}};export function applyRouteDiagnostics(response){return response}',
    '@/lib/projects/sharePointFiles/server': 'export const inlineTypes=new Set(["application/pdf","image/png"]); export async function projectGraph(...args){return globalThis.__sharePointHarnessGraph(...args)}',
    'server-only': '',
  };
  const built = await build({
    entryPoints: ['apps/portal/app/api/staff/v1/projects/[projectId]/files/[itemId]/open/route.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
    alias: { '@': path.resolve('apps/portal') },
    plugins: [{ name: 'synthetic-open-boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'synthetic-open-boundaries' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'synthetic-open-boundaries' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))).GET;
}
