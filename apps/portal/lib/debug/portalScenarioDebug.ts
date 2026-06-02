import type { PortalPageDebugExportScenario } from './portalPageDebugExport';

const AGENT_SCENARIO_PREFIX = '[Agent Scenario]';

export function inferPortalScenarioFromLabel(label: string | null | undefined): PortalPageDebugExportScenario | null {
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  if (!trimmedLabel.startsWith(AGENT_SCENARIO_PREFIX)) return null;

  return {
    scenarioId: null,
    label: trimmedLabel,
    notes: 'Inferred from deterministic agent scenario label prefix.',
  };
}
