/** Message identity is case-sensitive. Do not manufacture IDs from provider API IDs. */
export type MessageLineage = { internetMessageId?: string; inReplyTo: readonly string[]; references: readonly string[] };
export type ProjectMessageAnchor = { projectId: string; internetMessageId: string };
export type MessageProjectLink = { state: 'linked'; basis: 'sent_message' | 'reply_chain' }
  | { state: 'unconfirmed' | 'conflicting' };

export function validInternetMessageId(value: string): boolean {
  return value.length <= 998 && /^[\x21-\x7e]+$/.test(value) && /^<[^<>\s@]+@[^<>\s@]+>$/.test(value);
}

/** Pure bounded evidence graph; subjects, customer addresses and conversation IDs are not anchors.
 * Callers own project authorization, provider identity verification and coverage reporting.
 */
export function associateProjectMessages(projectId: string, messages: readonly { id: string; lineage?: MessageLineage }[],
  anchors: readonly ProjectMessageAnchor[], coverageComplete = true): Map<string, MessageProjectLink> {
  if (messages.length > 25 || anchors.length > 25 || new Set(messages.map(message => message.id)).size !== messages.length) {
    throw new Error('Association evidence exceeds its bounds.');
  }
  const projectsByIdentity = new Map<string, Set<string>>();
  for (const anchor of anchors) {
    if (!validInternetMessageId(anchor.internetMessageId)) throw new Error('Invalid anchor identity.');
    const projects = projectsByIdentity.get(anchor.internetMessageId) ?? new Set<string>();
    projects.add(anchor.projectId); projectsByIdentity.set(anchor.internetMessageId, projects);
  }
  const roots = new Map([...projectsByIdentity].map(([id, projects]) => [id, new Set(projects)]));
  const parents = new Map<string, Set<string>>();
  for (const message of messages) {
    const lineage = message.lineage;
    if (!lineage) continue;
    const values = [...lineage.inReplyTo, ...lineage.references];
    if (values.length > 100 || values.some(value => !validInternetMessageId(value))
      || (lineage.internetMessageId !== undefined && !validInternetMessageId(lineage.internetMessageId))) {
      throw new Error('Invalid message lineage.');
    }
    if (lineage.internetMessageId) {
      const previous = parents.get(lineage.internetMessageId) ?? new Set<string>();
      values.forEach(value => previous.add(value));
      parents.set(lineage.internetMessageId, previous);
    }
  }
  // At most one new edge per observed message is needed per pass; sets converge
  // even for cycles. Propagate every known project so mixed threads stay conflicts.
  for (let pass = 0; pass <= messages.length; pass++) {
    let changed = false;
    for (const [id, refs] of parents) {
      const projects = projectsByIdentity.get(id) ?? new Set<string>();
      for (const ref of refs) for (const owner of projectsByIdentity.get(ref) ?? []) {
        if (!projects.has(owner)) { projects.add(owner); changed = true; }
      }
      projectsByIdentity.set(id, projects);
    }
    if (!changed) break;
  }
  // A reply link requires every observed ancestry branch to terminate at a
  // verified send. An unknown branch could conceal another project's send.
  const resolvedCache = new Map<string, boolean>();
  function resolved(id: string, visiting = new Set<string>()): boolean {
    if (visiting.has(id)) return false;
    const cached = resolvedCache.get(id);
    if (cached !== undefined) return cached;
    const refs = parents.get(id);
    if (!refs?.size) return roots.has(id);
    const next = new Set(visiting); next.add(id);
    const complete = [...refs].every(ref => resolved(ref, next));
    resolvedCache.set(id, complete);
    return complete;
  }
  return new Map(messages.map(message => {
    const lineage = message.lineage;
    const owners = new Set<string>();
    if (lineage) for (const id of [lineage.internetMessageId, ...lineage.inReplyTo, ...lineage.references]) {
      if (id) for (const owner of projectsByIdentity.get(id) ?? []) owners.add(owner);
    }
    const direct = lineage?.internetMessageId && roots.get(lineage.internetMessageId)?.has(projectId);
    const references = lineage ? [...lineage.inReplyTo, ...lineage.references] : [];
    const replyResolved = coverageComplete && references.length > 0 &&
      (lineage?.internetMessageId ? resolved(lineage.internetMessageId) : references.every(ref => resolved(ref)));
    const link: MessageProjectLink = owners.size > 1 ? { state: 'conflicting' }
      : direct ? { state: 'linked', basis: 'sent_message' }
        : owners.has(projectId) && replyResolved ? { state: 'linked', basis: 'reply_chain' }
          : { state: 'unconfirmed' };
    return [message.id, link];
  }));
}
