// Operational transport only. The server owns grant scope and saved command payloads.
const PORTAL_ACTIONS_VERSION = 'portal_actions_v1';
const API = '/api/integrations/portal-actions/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class PortalActionsClientError extends Error {
  constructor(code, status) {
    super(`Portal actions request failed (${code}).`);
    this.name = 'PortalActionsClientError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

function fail(code, status) {
  throw new PortalActionsClientError(code, status);
}

function endpointOrigin(baseUrl, environment) {
  let url;
  try { url = new URL(baseUrl); } catch { fail('INVALID_BASE_URL'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (environment === 'staging' && loopback && url.protocol === 'http:'))) {
    fail('INVALID_BASE_URL');
  }
  return url.origin;
}

async function readJson(response, signal) {
  if (!response.body) fail('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) fail('TIMEOUT');
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        fail('RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('INVALID_RESPONSE'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('INVALID_RESPONSE');
  return result;
}

/** No credential persistence, logging, redirects, or automatic command retries. */
export function createPortalActionsClient({ baseUrl, token, environment, timeoutMs = 15_000, fetchImpl = globalThis.fetch } = {}) {
  if (!['staging', 'production'].includes(environment)) fail('INVALID_ENVIRONMENT');
  const origin = endpointOrigin(baseUrl, environment);
  if (typeof token !== 'string' || !/^spa1_[0-9a-f]{64}$/.test(token)) fail('INVALID_TOKEN');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) fail('INVALID_TIMEOUT');
  if (typeof fetchImpl !== 'function') fail('INVALID_TRANSPORT');

  async function request(path, method = 'GET', body) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PortalActionsClientError('TIMEOUT'));
      }, timeoutMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await fetchImpl(`${origin}${API}/${path}`, {
          method, redirect: 'error', credentials: 'omit', cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (response.redirected || (response.url && new URL(response.url).origin !== origin)) fail('INVALID_RESPONSE_ORIGIN');
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          fail('HTTP_ERROR', response.status);
        }
        if (controller.signal.aborted) fail('TIMEOUT');
        return await readJson(response, controller.signal);
      })()]);
    } catch (error) {
      if (error instanceof PortalActionsClientError) throw error;
      // Never retain a fetch error cause, request URL, token, or response body.
      fail(controller.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  async function health() {
    const identity = await request('connection');
    if (identity.version !== PORTAL_ACTIONS_VERSION || identity.environment !== environment) fail('CONNECTION_MISMATCH');
    if (typeof identity.grantId !== 'string' || !UUID.test(identity.grantId) ||
        typeof identity.actorUserId !== 'string' || !UUID.test(identity.actorUserId) ||
        typeof identity.expiresAt !== 'string' || !Number.isFinite(Date.parse(identity.expiresAt))) fail('INVALID_CONNECTION');
    if (Date.parse(identity.expiresAt) <= Date.now()) fail('CONNECTION_EXPIRED');
    return Object.freeze({ version: identity.version, environment: identity.environment,
      grantId: identity.grantId, actorUserId: identity.actorUserId, expiresAt: identity.expiresAt });
  }

  return Object.freeze({
    health,
    async projects() {
      await health();
      return request('projects');
    },
    async execute(commandId) {
      if (typeof commandId !== 'string' || !UUID.test(commandId)) fail('INVALID_COMMAND_ID');
      await health();
      return request('commands', 'POST', { commandId });
    },
  });
}
