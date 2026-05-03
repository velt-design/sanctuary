import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const ROOT = process.cwd();
const PORTAL_DIR = path.join(ROOT, 'apps', 'portal');
const DEFAULT_PORT = 3001;
const LOCK_PATH = path.join(PORTAL_DIR, '.next', 'lock');

function fail(lines) {
  console.error('Portal build preflight failed.');
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
  const parentPid = run('ps', ['-p', String(pid), '-o', 'ppid=']).trim();
  const parentCommandLine = parentPid ? run('ps', ['-p', parentPid, '-o', 'args=']) : '';
  return { pid: String(pid), parentPid, commandLine, parentCommandLine };
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

function normalizedCommand(info) {
  return `${info?.commandLine ?? ''} ${info?.parentCommandLine ?? ''}`.toLowerCase().replace(/\s+/g, ' ');
}

function isNextDevProcess(info) {
  const commandLine = normalizedCommand(info);
  return commandLine.includes('next') && commandLine.includes('dev');
}

function findPortalNextDevProcess() {
  const normalizedPortalDir = PORTAL_DIR.toLowerCase().replace(/\\/g, '/');

  if (process.platform === 'win32') {
    const output = ps(
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match 'next' -and $_.CommandLine -match 'dev' } | ForEach-Object { "$($_.ProcessId)|$($_.ParentProcessId)|$($_.CommandLine)" }`,
    );
    for (const line of output.split(/\r?\n/).filter(Boolean)) {
      const [pid, parentPid, ...commandParts] = line.split('|');
      const info = processInfo(pid) ?? { pid, parentPid, commandLine: commandParts.join('|') };
      const commandLine = normalizedCommand(info).replace(/\\/g, '/');
      if (commandLine.includes(normalizedPortalDir) || commandLine.includes('apps/portal')) {
        return info;
      }
    }
    return null;
  }

  const output = run('ps', ['-eo', 'pid=,ppid=,args=']);
  for (const line of output.split(/\r?\n/).filter((entry) => /next.*dev/i.test(entry))) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!match) continue;
    const [, pid, parentPid, commandLine] = match;
    const info = processInfo(pid) ?? { pid, parentPid, commandLine };
    const normalized = normalizedCommand(info);
    if (normalized.includes(normalizedPortalDir) || normalized.includes('apps/portal')) {
      return info;
    }
  }
  return null;
}

function failForProcess(info, reason) {
  const commandLine = info?.parentCommandLine || info?.commandLine || 'unknown command';
  const displayPid = info?.pid ?? 'unknown';
  fail([
    `${reason} (PID ${displayPid}).`,
    `Command: ${commandLine}`,
    'Portal build-dependent gates need Next build to own the portal .next workspace.',
    'Stop the existing portal dev server manually, then rerun the command.',
    'This preflight does not terminate processes or delete lock files.',
  ]);
}

async function main() {
  const portalDevProcess = findPortalNextDevProcess();
  if (portalDevProcess) {
    failForProcess(portalDevProcess, 'Detected an existing portal Next dev process before build');
  }

  const pid = listeningPid(DEFAULT_PORT);
  if (pid) {
    const info = processInfo(pid);
    if (isNextDevProcess(info)) {
      failForProcess(info, `Detected an existing Next dev server on port ${DEFAULT_PORT} before portal build`);
    }
  }

  if (fs.existsSync(LOCK_PATH)) {
    const available = await isPortAvailable(DEFAULT_PORT);
    if (!available && pid) {
      const info = processInfo(pid);
      if (isNextDevProcess(info)) {
        failForProcess(info, `Detected ${path.relative(ROOT, LOCK_PATH)} while port ${DEFAULT_PORT} is occupied by Next dev`);
      }
    }
    console.log(`portal-build-env: note (${path.relative(ROOT, LOCK_PATH)} exists, but no owning portal dev process was identified)`);
  }

  console.log('portal-build-env: ok (portal build can start)');
}

await main();
