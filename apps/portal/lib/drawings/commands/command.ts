export type Command = {
  label: string;
  apply: () => void;
  invert: () => Command;
};

export function inverseCommand(command: Command): Command {
  return command.invert();
}
