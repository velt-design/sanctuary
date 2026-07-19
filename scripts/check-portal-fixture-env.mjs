import { execFileSync } from 'node:child_process';
import net from 'node:net';

const ROOT = process.cwd();
const DEFAULT_PORT = 3011;
const port = Number.parseInt(process.env.PORTAL_PLAYWRIGHT_PORT ?? String(DEFAULT_PORT), 10);
const baseUrl = process.env.PORTAL_BASE_URL?.trim() || '';
const fixturePaths = [
  '/staff/projects/fixture-roof/design-workbench?fixture=mono-standard',
  '/qa/projects-index-mutation-fixture',
];
const requiredFixtureFlags =
  'Required fixture flags: ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1 and ENABLE_PORTAL_QA_FIXTURES=1.';
const manualSecondServerHint =
  'PORTAL_PLAYWRIGHT_DIST_DIR is only needed when you manually start a second Next dev server beside normal port 3001.';

function localFixtureServerLines() {
  const configuredPortLine =
    port === DEFAULT_PORT
      ? `The local Playwright-managed fixture server uses port ${DEFAULT_PORT} by default.`
      : `PORTAL_PLAYWRIGHT_PORT is set to ${port}, so the local Playwright-managed fixture server will use that port.`;
  return [
    configuredPortLine,
    'A normal npm run dev:portal server can stay on port 3001.',
    'Choose another PORTAL_PLAYWRIGHT_PORT for the local fixture server, or set PORTAL_BASE_URL to an already-running fixture-enabled portal server.',
    requiredFixtureFlags,
  ];
}

function externalFixtureServerLines() {
  return [
    'PORTAL_BASE_URL puts the fixture gate in external-server mode; Playwright will not start its own portal server.',
    'The external server must expose the fixture route without auth.',
    requiredFixtureFlags,
    manualSecondServerHint,
  ];
}

function fail(lines) {
  console.error('Portal fixture browser gate preflight failed.');
  for (const line of lines) console.error(line);
  process.exit(1);
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function ps(command) {
  return run('powershell.exe', ['-NoProfile', '-Command', command]);
}

function processInfo(pid) {
  if (!pid) return null;
  if (process.platform === 'win32') {
    const escapedPid = String(pid).replace(/'/g, "''");
    const processLine = ps(
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${escapedPid}"; if ($p) { "$($p.ProcessId)|$($p.ParentProcessId)|$($p.CommandLine)" }`,
    );
    if (!processLine) return { pid: String(pid), commandLine: '' };
    const [processId, parentPid, ...commandParts] = processLine.split('|');
    const parentLine = parentPid
      ? ps(
          `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${parentPid}"; if ($p) { "$($p.ProcessId)|$($p.CommandLine)" }`,
        )
      : '';
    return {
      pid: processId || String(pid),
      parentPid,
      commandLine: commandParts.join('|'),
      parentCommandLine: parentLine.split('|').slice(1).join('|'),
    };
  }

  const commandLine = run('ps', ['-p', String(pid), '-o', 'args=']);
  return { pid: String(pid), commandLine };
}

function listeningPid(targetPort) {
  if (process.platform === 'win32') {
    return ps(
      `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
    );
  }

  const lsof = run('lsof', ['-nP', `-iTCP:${targetPort}`, '-sTCP:LISTEN', '-t']);
  if (lsof) return lsof.split(/\r?\n/)[0];
  return '';
}

function isPortAvailable(targetPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      resolve(error.code !== 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(targetPort, '127.0.0.1');
  });
}

function isPortalNextDevProcess(info) {
  const commandLine = `${info?.commandLine ?? ''} ${info?.parentCommandLine ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return commandLine.includes('next') && commandLine.includes('dev');
}

async function checkLocalServerSlot() {
  const pid = listeningPid(port);
  if (pid) {
    const info = processInfo(pid);
    const commandLine = info?.parentCommandLine || info?.commandLine || 'unknown command';
    const displayPid = info?.pid ?? pid ?? 'unknown';
    const processHint = isPortalNextDevProcess(info)
      ? `Detected an existing portal Next dev server on port ${port} (PID ${displayPid}).`
      : `Port ${port} is already in use (PID ${displayPid}).`;

    fail([
      processHint,
      `Command: ${commandLine}`,
      ...localFixtureServerLines(),
    ]);
  }

  const available = await isPortAvailable(port);
  if (!available) {
    fail([
      `Port ${port} is already in use, but the owning process could not be identified.`,
      ...localFixtureServerLines(),
    ]);
  }

  console.log(`portal-fixture-env: ok (Playwright can start a fixture-enabled portal server on port ${port})`);
}

async function checkRemoteFixtureServer(targetBaseUrl) {
  for (const fixturePath of fixturePaths) {
    const url = new URL(fixturePath, targetBaseUrl);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      fail([
        `Could not reach PORTAL_BASE_URL fixture route: ${url.toString()}`,
        `Original error: ${String(error)}`,
        ...externalFixtureServerLines(),
      ]);
    }

    const location = response.headers.get('location') ?? '';
    if (response.status >= 300 && response.status < 400 && /\/login|access-status/i.test(location)) {
      fail([
        `PORTAL_BASE_URL redirects the fixture route to ${location || 'an auth route'}.`,
        'Fixture flags are missing or this server is auth-gating fixtures.',
        ...externalFixtureServerLines(),
      ]);
    }

    const body = await response.text();
    if (!response.ok || /staff login|\/login|access-status/i.test(body)) {
      fail([
        `PORTAL_BASE_URL did not expose the no-auth fixture route ${url.pathname} (${response.status} ${response.statusText}).`,
        'Fixture flags are missing or this server is auth-gating fixtures.',
        ...externalFixtureServerLines(),
      ]);
    }

    console.log(`portal-fixture-env: ok (${url.toString()} is reachable without auth)`);
  }
}

if (baseUrl) {
  await checkRemoteFixtureServer(baseUrl);
} else {
  await checkLocalServerSlot();
}
