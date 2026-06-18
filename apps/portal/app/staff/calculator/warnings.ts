import type { InfillWarningItem } from './infillCompute';

type UiSeverity = 'critical' | 'review' | 'info';

export type UiWarning =
  | {
      id: string;
      severity: UiSeverity;
      message: string;
      source: 'engine';
    }
  | {
      id: string;
      severity: UiSeverity;
      message: string;
      source: 'infill';
      infillId: string;
      warning: InfillWarningItem;
    };

export function mapEngineLevel(level: string): UiSeverity {
  return level === 'critical' ? 'critical' : 'review';
}

export function mapInfillSeverity(severity: InfillWarningItem['severity']): UiSeverity {
  if (severity === 'error') return 'critical';
  if (severity === 'warning') return 'review';
  return 'info';
}

