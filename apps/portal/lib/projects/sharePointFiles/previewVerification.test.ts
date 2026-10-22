import { expect, it, vi } from 'vitest';
import { readPreviewVerification } from './previewVerification';
it('bounds verification bodies before JSON parsing and cancels an oversized stream', async () => {
  const cancel = vi.fn(); const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8193)); }, cancel }), { headers: { 'content-type': 'application/json' } });
  await expect(readPreviewVerification(response)).rejects.toThrow(); expect(cancel).toHaveBeenCalledTimes(1);
});
it.each(['W/"v1"', 'unquoted'])('requires an exact strong verified version %s', async version => {
  await expect(readPreviewVerification(Response.json({ kind: 'project-file-current-v1', projectId: 'project', rootId: 'root', itemId: 'file', name: 'file.pdf', contentType: 'application/pdf', size: 3, version }))).rejects.toThrow();
});
