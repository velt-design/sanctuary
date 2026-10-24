import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { portalNextDevOwner, readProcessArgv } from './ci/portal-next-process-owner.mjs';

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
  return { pid: String(pid), parentPid, commandLine, parentCommandLine, argv: readProcessArgv(pid), parentArgv: readProcessArgv(parentPid) };
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

function findPortalNextDevProcess() {
  let records;
  if (process.platform === 'win32') {
    const output = ps("Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|nodejs|next)(\\.exe)?$' } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress");
    try {
      const parsed = JSON.parse(output || '[]');
      records = (Array.isArray(parsed) ? parsed : [parsed]).map(info => ({
        pid: String(info.ProcessId), parentPid: String(info.ParentProcessId), commandLine: info.CommandLine || '',
      }));
    } catch { return null; }
  } else {
    records = run('ps', ['-eo', 'pid=,ppid=,args=']).split(/\r?\n/).flatMap(line => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      return match ? [{ pid: match[1], parentPid: match[2], commandLine: match[3], argv: readProcessArgv(match[1]) }] : [];
    });
  }
  const byPid = new Map(records.map(info => [info.pid, info]));
  for (const info of records) {
    const owner = portalNextDevOwner({ ...info, parentCommandLine: byPid.get(info.parentPid)?.commandLine, parentArgv: byPid.get(info.parentPid)?.argv }, ROOT);
    if (owner) return owner;
  }
  return null;
}

function failForProcess(info, reason) {
  const commandLine = info?.commandLine || 'unknown command';
  const displayPid = info?.pid ?? 'unknown';
  fail([
    `${reason} (PID ${displayPid}).`,
    `Command: ${commandLine}`,
    ...(info?.ownerPid ? [`Next dev parent (PID ${info.ownerPid}): ${info.ownerCommandLine}`] : []),
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
    if (portalNextDevOwner(info, ROOT)) {
      failForProcess(info, `Detected an existing Next dev server on port ${DEFAULT_PORT} before portal build`);
    }
  }

  if (fs.existsSync(LOCK_PATH)) {
    const available = await isPortAvailable(DEFAULT_PORT);
    if (!available && pid) {
      const info = processInfo(pid);
      if (portalNextDevOwner(info, ROOT)) {
        failForProcess(info, `Detected ${path.relative(ROOT, LOCK_PATH)} while port ${DEFAULT_PORT} is occupied by Next dev`);
      }
    }
    console.log(`portal-build-env: note (${path.relative(ROOT, LOCK_PATH)} exists, but no owning portal dev process was identified)`);
  }

  console.log('portal-build-env: ok (portal build can start)');
}

await main();
