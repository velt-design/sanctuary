type Row = Record<string, any>;

export const factsId = (n: number, group = 1) => `${String(group).padStart(8, '0')}-1111-4111-8111-${String(n).padStart(12, '0')}`;

export function emptyFactsProject(id: string): Row {
  return { id, name: `Project ${id}`, pipeline_stage: 'CONTACTED', ownerAssignment: [], estimates: [], quotes: [] };
}

export function factsEnvelope(ids: readonly string[], projects = ids.map(emptyFactsProject), confirmations: Row[] = []) {
  return {
    version: 1,
    requestedCount: ids.length,
    rows: ids.map((projectId) => {
      const project = projects.find((row) => row.id === projectId) ?? null;
      const events = project ? confirmations.filter((row) => row.project_id === projectId) : [];
      const versions = project?.quotes.flatMap((quote: Row) => quote.quoteVersions) ?? [];
      return {
        projectId, eligible: project !== null, project, confirmations: events,
        counts: {
          estimates: project?.estimates.length ?? 0, quotes: project?.quotes.length ?? 0,
          quoteVersions: versions.length, sendLogs: versions.flatMap((version: Row) => version.sendLogs).length,
          confirmations: events.length,
        },
      };
    }),
  };
}
