/*
 * PR-W3a (2026-05-23) — shared rail field primitives extracted from
 * SanctuaryWorkbenchRail.tsx as the CAD-style UI cleanup begins. These
 * types describe the editable fields a rail section can render. The same
 * shape is consumed by the future right-inspector sections (PR-W3c) so
 * the rail→inspector migration is a layout move, not a contract change.
 */

export type CommitResult = { ok: boolean; error?: string };

export type SelectOption = { label: string; value: string; disabled?: boolean };

export type RailFieldDefinition =
  | {
      id: string;
      kind: 'select';
      label: string;
      value: string;
      options: SelectOption[];
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: string) => Promise<unknown> | void;
    }
  | {
      id: string;
      kind: 'number';
      label: string;
      value: string;
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: string) => Promise<unknown> | void;
    }
  | {
      id: string;
      kind: 'toggle';
      label: string;
      value: boolean;
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: boolean) => Promise<unknown> | void;
    };
