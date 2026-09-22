import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { readPortalActionToken } from './portal-actions-prompt.mjs';

const token = `spa1_${'a'.repeat(64)}`;
function fixture(options = {}) {
  const input = new EventEmitter();
  input.isTTY = true; input.isRaw = options.raw ?? false; input.readableFlowing = options.flowing ?? null;
  input.modes = []; input.setRawMode = (value) => { input.modes.push(value); input.isRaw = value; };
  input.resume = () => { input.readableFlowing = true; };
  input.pause = () => { input.readableFlowing = false; };
  input.references = []; input.ref = () => input.references.push('ref'); input.unref = () => input.references.push('unref');
  const output = []; const signals = new EventEmitter();
  const promise = readPortalActionToken({ input, write: (text) => output.push(text), destination: 'https://portal.example.test',
    environment: 'staging', signals, ...options });
  return { input, output, signals, promise, send: (value) => input.emit('data', Buffer.from(value)) };
}
function cleaned(f, raw = false) {
  assert.equal(f.input.isRaw, raw);
  assert.equal(f.input.listenerCount('data'), 0);
  assert.equal(f.signals.listenerCount('SIGINT'), 0);
  assert.equal(f.signals.listenerCount('SIGTERM'), 0);
  assert.ok(!f.output.join('').includes(token));
}

test('hidden terminal prompt identifies destination, accepts Windows CRLF, and restores terminal', async () => {
  const f = fixture();
  assert.equal(f.input.isRaw, true);
  assert.match(f.output.join(''), /Portal Actions connection\nDestination: https:\/\/portal.example.test\nEnvironment: staging/);
  f.send(`${token}\r\n`);
  assert.equal(await f.promise, token);
  assert.deepEqual(f.input.modes, [true, false]); cleaned(f);
  assert.deepEqual(f.input.references, ['ref', 'unref']);
});
test('split CR and LF are consumed without a second submission or input leak', async () => {
  const f = fixture(); f.send(`${token}\r`); f.send('\n');
  assert.equal(await f.promise, token); cleaned(f);
});
test('backspace supports correction without echo and existing raw/flow modes are preserved', async () => {
  const f = fixture({ raw: true, flowing: true }); f.send(`${token}x\x7f\r`);
  assert.equal(await f.promise, token); cleaned(f, true);
  assert.equal(f.input.readableFlowing, true);
  assert.deepEqual(f.input.references, []);
});
for (const input of ['\x03', '\x04', '\x1a', '\x1b']) {
  test(`cancel character ${JSON.stringify(input)} restores terminal and discards key`, async () => {
    const f = fixture(); f.send(token.slice(0, 25)); f.send(input);
    await assert.rejects(f.promise, { code: 'CANCELLED' }); cleaned(f);
  });
}
for (const event of ['SIGINT', 'SIGTERM']) {
  test(`${event} cancellation removes handlers and restores raw mode`, async () => {
    const f = fixture(); f.signals.emit(event);
    await assert.rejects(f.promise, { code: 'CANCELLED' }); cleaned(f);
  });
}
test('oversized, invalid and multiline pastes fail without including input in errors', async () => {
  for (const value of ['x'.repeat(129), 'invalid\r', `${token}\r\nsecond-line`, `${token}\t`]) {
    const f = fixture(); f.send(value);
    await assert.rejects(f.promise, (error) => {
      assert.equal(error.code, 'INVALID_INPUT'); assert.ok(!error.stack.includes(token)); return true;
    }); cleaned(f);
  }
});
test('input error, EOF and timeout restore terminal', async () => {
  for (const mode of ['error', 'end', 'timeout']) {
    const f = fixture({ timeoutMs: 10 });
    if (mode === 'error') f.input.emit('error', new Error(token));
    if (mode === 'end') f.input.emit('end');
    await assert.rejects(f.promise); cleaned(f);
  }
});
test('output failure after raw mode change still restores it', async () => {
  const f = fixture({ write: () => { throw new Error('output unavailable'); } });
  await assert.rejects(f.promise); cleaned(f);
});
test('pipe mode remains noninteractive and bounded', async () => {
  const output = [];
  assert.equal(await readPortalActionToken({ input: Readable.from([`${token}\r\n`]), write: (value) => output.push(value) }), token);
  assert.deepEqual(output, []);
  await assert.rejects(readPortalActionToken({ input: Readable.from(['x'.repeat(129)]) }), { code: 'INVALID_INPUT' });
});
