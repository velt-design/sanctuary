const TOKEN = /^spa1_[0-9a-f]{64}$/;
const MAX_INPUT = 128;

export class PortalActionPromptError extends Error {
  constructor(code) { super('Connection key input was not completed.'); this.name = 'PortalActionPromptError'; this.code = code; }
}
const failure = (code) => new PortalActionPromptError(code);

/** Read credentials without echo, shell arguments, readline history, or logging. */
export async function readPortalActionToken({ input = process.stdin, write = (text) => process.stderr.write(text),
  destination, environment, signals = process, timeoutMs = 300_000 } = {}) {
  if (!input.isTTY) {
    let text = '';
    try {
      for await (const chunk of input) {
        text += chunk.toString('utf8');
        if (text.length > MAX_INPUT) throw failure('INVALID_INPUT');
      }
      const token = text.trim();
      if (!TOKEN.test(token)) throw failure('INVALID_INPUT');
      return token;
    } finally { text = ''; }
  }
  if (typeof input.setRawMode !== 'function') throw failure('NO_SECURE_TERMINAL');
  return new Promise((resolve, reject) => {
    const previousRaw = input.isRaw === true;
    const previousFlowing = input.readableFlowing === true;
    let text = '';
    let endedLine = false;
    let settled = false;
    let timeout;
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      input.removeListener('data', onData); input.removeListener('end', onEnd); input.removeListener('error', onError);
      signals.removeListener('SIGINT', onCancel); signals.removeListener('SIGTERM', onCancel);
      let token = text.trim(); text = '';
      try {
        if (!previousFlowing) {
          input.pause();
          // Windows TTY handles can remain referenced after pause; release this
          // prompt's idle reader so a completed CLI can return to the shell.
          input.unref?.();
        }
        input.setRawMode(previousRaw);
        write('\n');
      } catch { error = failure('TERMINAL_RESTORE_FAILED'); }
      if (error) reject(error);
      else if (!TOKEN.test(token)) reject(failure('INVALID_INPUT'));
      else resolve(token);
      token = '';
    }
    function onCancel() { finish(failure('CANCELLED')); }
    function onEnd() { finish(failure('INPUT_ENDED')); }
    function onError() { finish(failure('INPUT_FAILED')); }
    function onData(chunk) {
      try {
        const data = chunk.toString('utf8');
        for (const character of data) {
          if (['\x03', '\x04', '\x1a', '\x1b'].includes(character)) return onCancel();
          if (character === '\r' || character === '\n') {
            endedLine = true;
          } else if (endedLine) {
            return finish(failure('INVALID_INPUT'));
          } else if (character === '\x7f' || character === '\b') {
            text = text.slice(0, -1);
          } else if (character === '\x15') {
            text = '';
          } else if (character < ' ' || character > '~') {
            return finish(failure('INVALID_INPUT'));
          } else {
            text += character;
            if (text.length > MAX_INPUT) return finish(failure('INVALID_INPUT'));
          }
        }
        // Finish during the read callback, before Windows starts another blocking
        // console read. Consume a whole CRLF paste chunk before restoring echo.
        if (endedLine) finish();
      } catch { finish(failure('INPUT_FAILED')); }
    }
    try {
      input.on('data', onData); input.once('end', onEnd); input.once('error', onError);
      signals.on('SIGINT', onCancel); signals.on('SIGTERM', onCancel);
      input.setRawMode(true);
      if (!previousFlowing) input.ref?.();
      write(`Portal Actions connection\nDestination: ${destination}\nEnvironment: ${environment}\nPaste the connection key (hidden), then press Enter. Ctrl+C cancels.\nConnection key: `);
      timeout = setTimeout(() => finish(failure('TIMED_OUT')), timeoutMs);
      input.resume();
    } catch { finish(failure('NO_SECURE_TERMINAL')); }
  });
}
