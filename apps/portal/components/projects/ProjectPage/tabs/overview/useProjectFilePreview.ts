'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { PREVIEW_VERSION_REQUEST_HEADER, readPreviewVerification } from '@/lib/projects/sharePointFiles/previewVerification';
import { strongFileVersion, VERIFIED_FILE_VERSION_HEADER } from '@/lib/projects/sharePointFiles/fileVersion';
import { discardPreview, discardProjectPreviews, readPreview, retainPreview, setPreviewOwner, type PreviewBytes, type PreviewScope } from './projectFilePreviewCache';
import { ProjectPdfStream } from './ProjectPdfStream';

const INLINE_LIMIT = 50_000_000;
const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
type Item = ProjectFilesPage['items'][number];
type Result = { identity: string; data?: Uint8Array; image?: string; stream?: ProjectPdfStream; name?: string; checking?: boolean; error?: string };
function responseName(response: Response, fallback: string) {
  try {
    const encoded = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const name = encoded ? decodeURIComponent(encoded) : fallback;
    return name.length > 0 && name.length <= 400 && !/[\x00-\x1f]/.test(name) ? name : fallback;
  } catch { return fallback; }
}

export function useProjectFilePreview({ url, item, scope, revision, onChanged }: {
  url: string | null; item: Item; scope: PreviewScope | null; revision: number; onChanged: () => void;
}) {
  const client = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const onChangedRef = useRef(onChanged); onChangedRef.current = onChanged;
  const scopeId = scope ? JSON.stringify(scope) : 'unscoped';
  const identity = `${scopeId}:${url}:${item.eTag ?? item.cTag ?? item.modifiedAt ?? ''}:${revision}:${attempt}`;
  useLayoutEffect(() => {
    setPreviewOwner(client, scope?.owner ?? null);
    setResult(null);
    if (!url) return;
    let disposed = false, objectUrl: string | undefined;
    const controller = new AbortController();
    const showBytes = (body: PreviewBytes, checking: boolean) => {
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
      if (body.mime === 'application/pdf') setResult({ identity, data: body.bytes, name: body.name, checking });
      else { objectUrl = URL.createObjectURL(new Blob([new Uint8Array(body.bytes)], { type: body.mime })); setResult({ identity, image: objectUrl, name: body.name, checking }); }
    };
    const resident = scope ? readPreview(client, scope, [item.eTag, item.cTag]) : null;
    if (resident) showBytes({ ...resident, name: item.name }, true);
    const fail = (message: string) => {
      if (scope) discardProjectPreviews(client, scope.owner, scope.projectId);
      if (!disposed) setResult({ identity, error: message });
    };
    const timeout = setTimeout(() => { controller.abort(); fail('The preview timed out. Retry or download the original.'); }, 50_000);
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: resident ? { [PREVIEW_VERSION_REQUEST_HEADER]: resident.version } : {} });
        if (disposed || controller.signal.aborted) return;
        const name = responseName(response, item.name);
        const originVersion = strongFileVersion(response.headers.get('etag'));
        const verifiedVersion = strongFileVersion(response.headers.get(VERIFIED_FILE_VERSION_HEADER));
        if (response.status === 304) throw new Error('The preview could not be verified. Retry to load it again.');
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'File access is unavailable. Refresh Files to check access.' : response.status === 404 ? 'This file has moved or is no longer available. Refresh the folder.' : 'The preview could not be loaded. Retry or download the original.');
        const mime = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
        if (mime === 'application/json') {
          if (response.status !== 200 || !scope || !resident) throw new Error('The preview could not be verified. Retry to load it again.');
          const receipt = await readPreviewVerification(response);
          if (disposed || controller.signal.aborted) return;
          if (receipt.projectId !== scope.projectId || receipt.rootId !== scope.rootId || receipt.itemId !== scope.itemId || receipt.version !== resident.version || receipt.contentType !== resident.mime || receipt.size !== resident.bytes.byteLength) throw new Error('The preview could not be verified. Retry to load it again.');
          retainPreview(client, scope, { ...resident, name: receipt.name });
          setResult(previous => previous?.identity === identity ? { ...previous, name: receipt.name, checking: false } : previous);
          return;
        }
        if (mime !== 'application/pdf' && !rasterTypes.has(mime)) throw new Error('Download the original to open this file.');
        const declared = Number(response.headers.get('content-length') ?? 0);
        if (declared > INLINE_LIMIT) throw new Error('This preview exceeds 50 MB. Download the original instead.');
        const reader = response.body?.getReader(); if (!reader) throw new Error('The preview body was unavailable.');
        const length = declared;
        const stream = mime === 'application/pdf' && length > 0 && length <= INLINE_LIMIT ? new ProjectPdfStream(length) : null;
        if (stream) setResult({ identity, stream, name });
        const chunks: Uint8Array[] = []; let received = 0;
        try {
          for (;;) {
            const part = await reader.read(); if (part.done) break;
            received += part.value.byteLength;
            if (received > INLINE_LIMIT) throw new Error('This preview exceeds 50 MB. Download the original instead.');
            chunks.push(part.value); stream?.append(part.value);
          }
        } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
        if (disposed || controller.signal.aborted) return;
        if (!received) throw new Error('The preview body was unavailable.');
        const bytes = new Uint8Array(received); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        stream?.finish();
        const body = { bytes, mime, name, version: verifiedVersion ?? '' };
        // Only origin-verified complete representations may enter recent-file memory.
        if (scope && verifiedVersion && response.status === 200 && (!declared || declared === received)) retainPreview(client, scope, body);
        else if (scope) discardPreview(client, scope);
        if (!stream || stream.length !== received) showBytes(body, false);
        if (originVersion && [item.eTag, item.cTag].some(Boolean) && ![item.eTag, item.cTag].includes(originVersion)) onChangedRef.current();
      } catch (error) { if (!disposed && !controller.signal.aborted) fail(error instanceof Error ? error.message : 'Preview unavailable.'); }
      finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, identity]);
  return {
    result: result?.identity === identity ? result : null,
    retry: () => setAttempt(value => value + 1),
    imageError: () => { if (scope) discardPreview(client, scope); setResult({ identity, error: 'The image could not be displayed. Retry or download the original.' }); },
  };
}
