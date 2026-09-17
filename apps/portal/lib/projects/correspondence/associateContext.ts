import type { ProjectCorrespondenceContext } from './contract';
import { associateProjectMessages, type ProjectMessageAnchor } from './messageAssociation';

export function associateCorrespondenceContext(context: ProjectCorrespondenceContext, projectId: string,
  evidence: { anchors: ProjectMessageAnchor[]; incomplete: boolean }): ProjectCorrespondenceContext {
  const links = associateProjectMessages(projectId, context.messages ?? [], evidence.anchors, !evidence.incomplete);
  return { ...context, messages: context.messages?.map(({ lineage: _lineage, projectLink: _untrustedLink, ...message }) => ({
    ...message, projectLink: links.get(message.id) ?? { state: 'unconfirmed' as const },
  })), limitations: [...context.limitations,
    'Project links use recorded sent-message identity or reply references; they do not establish acceptance or agreed scope.',
    ...(evidence.incomplete ? ['Some recorded sent-message identities could not be checked; unlinked mail may still concern this project.'] : []),
  ] };
}
