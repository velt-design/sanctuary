type CommandIdFactory = () => string;

function defaultCommandId(): string {
  return crypto.randomUUID();
}

/**
 * Retains a command ID while the same user intent is retried.
 *
 * A transport failure is ambiguous: the server may already have committed.
 * Reusing the ID lets the command receipt return that result instead of
 * applying the same intent twice.
 */
export class StableCommandAttempt {
  private current: { intent: string; commandId: string } | null = null;

  constructor(private readonly createCommandId: CommandIdFactory = defaultCommandId) {}

  commandIdFor(intent: string): string {
    if (this.current?.intent === intent) return this.current.commandId;
    const commandId = this.createCommandId();
    this.current = { intent, commandId };
    return commandId;
  }

  committed(intent: string): void {
    if (this.current?.intent === intent) this.current = null;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function projectCommandIntent(
  command: string,
  payload: Record<string, unknown> = {},
): string {
  return `${command}:${stableJson(payload)}`;
}
