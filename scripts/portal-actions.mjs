#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createPortalActionsClient } from './lib/portal-actions-client.mjs';
import { createPortalCredentialStore } from './lib/portal-actions-credential-store.mjs';
import { readPortalActionToken, PortalActionPromptError } from './lib/portal-actions-prompt.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'Usage: portal-actions connect --base-url <origin> --environment <staging|production> (hidden terminal prompt or token on stdin), health, projects, execute <commandUUID>, disconnect';
function parse(args) {
  const [command, ...rest] = args;
  if (command === 'connect' && rest.length === 4 && rest[0] === '--base-url' && rest[2] === '--environment' && ['staging', 'production'].includes(rest[3])) {
    return { command, baseUrl: rest[1], environment: rest[3] };
  }
  if (['health', 'projects', 'disconnect'].includes(command) && rest.length === 0) return { command };
  if (command === 'execute' && rest.length === 1 && UUID.test(rest[0])) return { command, commandId: rest[0].toLowerCase() };
  throw new Error('INVALID_ARGUMENTS');
}
function sameIdentity(expected, current) {
  return ['version', 'environment', 'grantId', 'actorUserId', 'expiresAt'].every(key => expected[key] === current[key]);
}

/** Injectable entry point. Production transport never logs tokens or error causes. */
export async function runPortalActions(args, { input = process.stdin, output = text => process.stdout.write(text),
  errorOutput = text => process.stderr.write(text), storeFactory = createPortalCredentialStore,
  clientFactory = createPortalActionsClient } = {}) {
  let parsed; let token;
  const emit = value => output(`${JSON.stringify(value, null, 2).replace(/spa1_[0-9a-f]{64}/gi, '[credential redacted]')}\n`);
  try {
    parsed = parse(args);
    const store = storeFactory();
    if (parsed.command === 'disconnect') { emit(await store.disconnect()); return 0; }
    if (parsed.command === 'connect') {
      // Validate the destination before displaying it. This validation-only
      // placeholder client performs no request and is never saved or used.
      createPortalActionsClient({ baseUrl: parsed.baseUrl, environment: parsed.environment, token: `spa1_${'0'.repeat(64)}` });
      token = await readPortalActionToken({ input, write: errorOutput,
        destination: new URL(parsed.baseUrl).origin, environment: parsed.environment });
      const client = clientFactory({ baseUrl: parsed.baseUrl, environment: parsed.environment, token });
      const identity = await client.health();
      await store.save({ version: 1, baseUrl: parsed.baseUrl, environment: parsed.environment, token, identity });
      emit({ connected: true, baseUrl: new URL(parsed.baseUrl).origin, ...identity });
      return 0;
    }
    const connection = await store.read();
    if (!connection) throw new Error('NO_SAVED_CONNECTION');
    token = connection.token;
    const client = clientFactory(connection);
    const identity = await client.health();
    if (!sameIdentity(connection.identity, identity)) throw new Error('SAVED_IDENTITY_CHANGED');
    if (parsed.command === 'health') emit({ connected: true, baseUrl: connection.baseUrl, ...identity });
    if (parsed.command === 'projects') emit(await client.projects());
    if (parsed.command === 'execute') emit(await client.execute(parsed.commandId));
    return 0;
  } catch (error) {
    // Never echo argv, a response body, a credential, or a nested exception.
    if (error instanceof PortalActionPromptError && error.code === 'CANCELLED') errorOutput('Connection setup cancelled. No connection was saved.\n');
    else if (!parsed) errorOutput(`${USAGE}\n`);
    else if (parsed.command === 'execute') errorOutput(`Portal action outcome is unverified. Do not create a new command ID. Reconcile or retry the SAME command ID: ${parsed.commandId}. No automatic retry was performed.\n`);
    else errorOutput('Portal connection operation failed. Check the saved destination, access, expiry and local credential protection.\n');
    return 1;
  } finally { token = undefined; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runPortalActions(process.argv.slice(2));
}
