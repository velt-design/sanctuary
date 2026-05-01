import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const [, , scriptName, ...extraArgs] = process.argv;

function fail(message, exitCode = 1) {
  console.error(`run-logged-command: ${message}`);
  process.exit(exitCode);
}

if (!scriptName || extraArgs.length > 0) {
  fail('expected exactly one npm script name, for example: node scripts/run-logged-command.mjs portal:doctor:quick', 2);
}

const packageJsonPath = path.join(ROOT, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  fail('package.json was not found in the current working directory', 2);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (!packageJson.scripts || !Object.prototype.hasOwnProperty.call(packageJson.scripts, scriptName)) {
  fail(`unknown npm script "${scriptName}"`, 2);
}

if (!/^[a-zA-Z0-9:._-]+$/.test(scriptName)) {
  fail(`npm script name contains unsupported characters: "${scriptName}"`, 2);
}

const logDir = path.join(os.tmpdir(), 'sanctuary-portal-gate-logs');
fs.mkdirSync(logDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const safeName = scriptName.replace(/[^a-zA-Z0-9._-]/g, '-');
const logPath = path.join(logDir, `${timestamp}-${process.pid}-${safeName}.log`);
const logStream = fs.createWriteStream(logPath, { flags: 'w' });
const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
const args = process.platform === 'win32' ? ['/d', '/s', '/c', `npm run ${scriptName}`] : ['run', scriptName];
const start = Date.now();

console.log(`Command: npm run ${scriptName}`);
console.log(`Log: ${logPath}`);

let child;

try {
  child = spawn(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
} catch (error) {
  logStream.end(`\nrun-logged-command failed to start child process: ${error.message}\n`);
  fail(`failed to start npm: ${error.message}`);
}

child.stdout.pipe(logStream, { end: false });
child.stderr.pipe(logStream, { end: false });

function tailLines(filePath, lineCount) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trimEnd();
  if (!text) return [];
  return text.split(/\r?\n/).slice(-lineCount);
}

child.on('error', (error) => {
  logStream.write(`\nrun-logged-command failed to start child process: ${error.message}\n`);
});

child.on('close', (code, signal) => {
  const durationSeconds = ((Date.now() - start) / 1000).toFixed(1);
  logStream.end(() => {
    const exitCode = typeof code === 'number' ? code : 1;
    const status = signal ? `signal ${signal}` : `exit code ${exitCode}`;

    console.log(`Duration: ${durationSeconds}s`);
    console.log(`Exit: ${status}`);

    if (exitCode === 0 && !signal) {
      console.log(`Result: PASS - npm run ${scriptName}`);
      process.exit(0);
    }

    console.log(`Result: FAIL - npm run ${scriptName}`);
    console.log('Last 120 log lines:');
    for (const line of tailLines(logPath, 120)) {
      console.log(line);
    }
    process.exit(exitCode);
  });
});
