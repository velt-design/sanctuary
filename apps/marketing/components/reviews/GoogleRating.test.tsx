// @vitest-environment node
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import GoogleRating from './GoogleRating';
import { getGoogleRating } from '../../lib/googleReviews';

vi.mock('../../lib/googleReviews', () => ({ getGoogleRating: vi.fn() }));

it('streams real page content and a plain review link before a slow rating, then the truthful result', async () => {
  let accept!: (value: Awaited<ReturnType<typeof getGoogleRating>>) => void;
  vi.mocked(getGoogleRating).mockReturnValue(new Promise(resolve => { accept = resolve; }));
  const output = new PassThrough(); let html = '';
  output.on('data', chunk => { html += chunk.toString(); });
  const finished = new Promise<void>(resolve => output.on('end', resolve));
  let shell!: () => void; const shellReady = new Promise<void>(resolve => { shell = resolve; });
  const errors: unknown[] = [];
  const stream = renderToPipeableStream(<main><h1>First screen</h1><GoogleRating fallback={<a href="/reviews">Google reviews</a>}>
    {rating => <p>{rating.rating.toFixed(1)} from {rating.count} reviews</p>}
  </GoogleRating></main>, { onShellReady() { stream.pipe(output); shell(); }, onError(error) { errors.push(error); } });
  try {
    await shellReady;
    expect(html).toContain('First screen'); expect(html).toContain('Google reviews');
    expect(html).not.toContain('4.7'); expect(html).not.toContain('72 reviews');
    accept({ rating: 4.7, count: 72, source: 'google' }); await finished;
    expect(html).toMatch(/4\.7[\s\S]*72[\s\S]*reviews/); expect(errors).toEqual([]);
  } finally { stream.abort(); }
});
