import { spawn } from 'node:child_process';
import { createPortalActionsClient } from './portal-actions-client.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')
$mutex = $null
$locked = $false
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  $mutex = [Threading.Mutex]::new($false, ('Local\Sanctuary.PortalActions.' + $sid.Value))
  $locked = $mutex.WaitOne(3000)
  if (-not $locked) { throw 'Credential storage busy' }
  $root = [Environment]::GetFolderPath('LocalApplicationData')
  if (-not [IO.Path]::IsPathRooted($root) -or $root.StartsWith('\\') -or $root -match '(?i)(^|[\\/])OneDrive([^\\/]*)([\\/]|$)') { throw 'Invalid storage root' }
  $parent = Join-Path $root 'Sanctuary'
  $directory = Join-Path $parent 'PortalActions'
  $file = Join-Path $directory 'connection.dpapi'
  function Check-Node([string]$path, [bool]$isDirectory) {
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.PSIsContainer -ne $isDirectory) { throw 'Unsafe storage path' }
  }
  function Protect-Node([string]$path, [bool]$isDirectory) {
    if ($isDirectory) {
      $acl = [Security.AccessControl.DirectorySecurity]::new()
      $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    } else {
      $acl = [Security.AccessControl.FileSecurity]::new()
      $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($identity in @($sid, $systemSid)) {
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, [Security.AccessControl.FileSystemRights]::FullControl, $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow))
    }
    Set-Acl -LiteralPath $path -AclObject $acl
  }
  function Check-Protection([string]$path) {
    $acl = Get-Acl -LiteralPath $path
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Unprotected storage' }
    $ownFull = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.IdentityReference.Value -notin @($sid.Value, $systemSid.Value)) { throw 'Unexpected storage permission' }
      if ($rule.IdentityReference.Value -eq $sid.Value -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $ownFull = $true }
    }
    if (-not $ownFull) { throw 'Missing owner permission' }
  }
  function Read-Connection {
    if ((Get-Item -LiteralPath $file).Length -gt 65536) { throw 'Oversize credential' }
    $secure = ConvertTo-SecureString ([IO.File]::ReadAllText($file))
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
  }
  if (Test-Path -LiteralPath $parent) { Check-Node $parent $true }
  if (-not (Test-Path -LiteralPath $directory)) {
    if ($request.operation -ne 'save') { [Console]::Out.Write('{"missing":true}'); exit 0 }
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    Protect-Node $directory $true
  }
  Check-Node $directory $true
  Check-Protection $directory
  $exists = Test-Path -LiteralPath $file
  if ($exists) { Check-Node $file $false; Check-Protection $file }
  switch ($request.operation) {
    'read' {
      if (-not $exists) { [Console]::Out.Write('{"missing":true}'); break }
      [Console]::Out.Write((Read-Connection))
    }
    'save' {
      if ($exists) {
        $previous = Read-Connection | ConvertFrom-Json
        $next = $request.payload | ConvertFrom-Json
        if ($previous.version -ne 1 -or $previous.environment -cne $next.environment -or $previous.baseUrl -cne $next.baseUrl) { throw 'Disconnect before changing destination' }
      }
      $secure = ConvertTo-SecureString -String ([string]$request.payload) -AsPlainText -Force
      try { $encrypted = ConvertFrom-SecureString -SecureString $secure } finally { $secure.Dispose() }
      $temporary = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.tmp')
      try {
        $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $bytes = [Text.Encoding]::ASCII.GetBytes($encrypted); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        Protect-Node $temporary $false
        Check-Protection $temporary
        if ($exists) { [IO.File]::Replace($temporary, $file, $null) } else { [IO.File]::Move($temporary, $file) }
        Check-Protection $file
      } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
      [Console]::Out.Write('{"saved":true}')
    }
    'disconnect' {
      if ($exists) { [IO.File]::Delete($file) }
      [Console]::Out.Write('{"disconnected":true}')
    }
    default { throw 'Invalid storage operation' }
  }
} catch { [Console]::Error.WriteLine('Credential storage unavailable.'); exit 1 }
finally { if ($mutex) { if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() } }
`;

export class PortalCredentialError extends Error {
  constructor(code) { super(`Portal credential operation failed (${code}).`); this.name = 'PortalCredentialError'; this.code = code; }
}
function fail(code) { throw new PortalCredentialError(code); }

function windowsBridge(request) {
  return new Promise((resolve, reject) => {
    // The encoded script is fixed; credentials travel only on the child stdin.
    const child = spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(STORE_SCRIPT, 'utf16le').toString('base64')],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(new PortalCredentialError('STORAGE_UNAVAILABLE')); else resolve(value);
    };
    const timer = setTimeout(() => { child.kill(); finish(true); }, 10_000);
    child.on('error', () => finish(true));
    child.stdin.on('error', () => finish(true));
    child.stderr.resume();
    child.stdout.on('data', chunk => {
      output += chunk.toString('utf8');
      if (output.length > 65_536) { child.kill(); finish(true); }
    });
    child.on('close', status => {
      if (status !== 0) return finish(true);
      try { finish(false, JSON.parse(output)); } catch { finish(true); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 ||
      Object.keys(value).some(key => !['version', 'baseUrl', 'environment', 'token', 'identity'].includes(key))) fail('INVALID_SAVED_CONNECTION');
  try { createPortalActionsClient(value); } catch { fail('INVALID_SAVED_CONNECTION'); }
  const identity = value.identity;
  if (!identity || identity.version !== 'portal_actions_v1' || identity.environment !== value.environment ||
      !UUID.test(identity.grantId ?? '') || !UUID.test(identity.actorUserId ?? '') ||
      typeof identity.expiresAt !== 'string' || !Number.isFinite(Date.parse(identity.expiresAt)) ||
      Object.keys(identity).some(key => !['version', 'environment', 'grantId', 'actorUserId', 'expiresAt'].includes(key))) fail('INVALID_SAVED_CONNECTION');
  return { version: 1, baseUrl: new URL(value.baseUrl).origin, environment: value.environment,
    token: value.token, identity: { ...identity } };
}

/** DPAPI and protected ACLs bind this one connection to the current Windows user. */
export function createPortalCredentialStore({ platform = process.platform, bridge = windowsBridge } = {}) {
  if (platform !== 'win32') fail('WINDOWS_REQUIRED');
  async function call(request) {
    try { return await bridge(request); } catch { fail('STORAGE_UNAVAILABLE'); }
  }
  async function read() {
    const result = await call({ operation: 'read' });
    if (result?.missing === true && Object.keys(result).length === 1) return null;
    return validate(result);
  }
  return Object.freeze({
    read,
    async save(connection) {
      const validated = validate(connection);
      const previous = await read();
      if (previous && (previous.environment !== validated.environment || previous.baseUrl !== validated.baseUrl)) fail('DISCONNECT_BEFORE_CHANGING_DESTINATION');
      const result = await call({ operation: 'save', payload: JSON.stringify(validated) });
      if (result?.saved !== true) fail('STORAGE_UNAVAILABLE');
    },
    async disconnect() {
      const result = await call({ operation: 'disconnect' });
      if (result?.disconnected !== true && result?.missing !== true) fail('STORAGE_UNAVAILABLE');
      return { disconnected: true, serverGrantRevoked: false };
    },
  });
}
