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
      /**
       * PR-T6 (2026-05-26): when true and the field's current value is the
       * empty string (the "auto / default" sentinel used by the override
       * options), the select renders in a muted text color so the user can
       * tell at a glance that the value is system-resolved rather than
       * manually chosen. Member-size overrides set this; one-off pickers
       * (gable end frames, footprint preset, etc.) leave it false.
       */
      mutedWhenEmpty?: boolean;
      onCommit: (value: string) => Promise<unknown> | void;
    }
  | {
      id: string;
      kind: 'number';
      label: string;
      value: string;
      /**
       * PR-T6 (2026-05-26): unit string rendered after the input value
       * (e.g. "m", "mm", "deg"). When set, the label no longer carries
       * `(m)` etc. — units belong with the value, not the label.
       */
      unit?: string;
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
