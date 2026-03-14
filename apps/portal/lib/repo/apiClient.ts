import { saveTracker } from '@/lib/sync/saveTracker';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, opts: { status: number; body: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.body = opts.body;
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit & { skipSaveTracking?: boolean }): Promise<T> {
  const run = async () => {
    const method = String(init?.method ?? 'GET').toUpperCase();
    const res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...(method === 'GET' ? {} : { cache: 'no-store' }),
      credentials: 'same-origin',
    });

    const body = await parseJsonSafe(res);
    if (!res.ok) {
      const msg = typeof (body as any)?.error === 'string' ? String((body as any).error) : `Request failed (${res.status})`;
      throw new ApiError(msg, { status: res.status, body });
    }
    return body as T;
  };

  const method = String(init?.method ?? 'GET').toUpperCase();
  const skipSaveTracking = Boolean(init?.skipSaveTracking) || method === 'GET';
  if (skipSaveTracking) return run();
  return saveTracker.track(run);
}
