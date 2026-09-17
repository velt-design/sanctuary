import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { correspondenceSourceHref, type ProjectCorrespondenceContext } from './projectCorrespondencePresentation';
import styles from './ProjectCorrespondenceCard.module.css';
import { projectEmailGroups, referencesProjectQuote, type EmailProjectContext } from './projectEmailGroups';

export default function ProjectEmailMessages({ messages, sample, project = {}, expanded, onExpand, earlierOpen, onEarlierOpen }: {
  messages: NonNullable<ProjectCorrespondenceContext['messages']>; sample: boolean;
  project?: EmailProjectContext; expanded: ReadonlySet<string>; onExpand: (id: string, open: boolean) => void;
  earlierOpen: boolean; onEarlierOpen: (open: boolean) => void;
}) {
  const { featured, earlier, latestCustomer, unconfirmed, latestUnconfirmedCustomer, unconfirmedPreview, unconfirmedEarlier } = projectEmailGroups(messages, project.customerEmail);
  function renderMessage({ message, copies }: (typeof featured)[number], label?: string) {
      const href = correspondenceSourceHref(message.url);
      const preview = message.bodyText.slice(0, 200);
      const expandable = message.bodyText.length > preview.length;
      return <article key={message.id} className={styles.message}>
        {label ? <p className={styles.messageLabel}>{label}</p> : null}
        <h3>{message.subject || 'No subject'}</h3>
        <p className={styles.explanation}>From {message.from} · {formatPortalDateTime(message.sentAt)}</p>
        {message.projectLink?.state === 'linked' && message.projectLink.basis === 'reply_chain' ? <p className={styles.explanation}>Reply to this project’s email. The conversation may also discuss other work.</p> : null}
        {message.projectLink?.state !== 'linked' ? <p className={styles.explanation}>{message.projectLink?.state === 'conflicting' ? 'This conversation references more than one project.' : 'Project match not confirmed — this may concern another job.'}</p> : null}
        {referencesProjectQuote(message, project.quoteRef) ? <p className={styles.quoteMatch}>References this project’s quote {project.quoteRef}</p> : null}
        {!(expandable && expanded.has(message.id)) ? <blockquote>{preview || 'Message text unavailable in this check.'}{expandable ? '…' : ''}</blockquote> : null}
        {expandable ? <details className={styles.sources} open={expanded.has(message.id)} onToggle={event => onExpand(message.id, event.currentTarget.open)}>
          <summary>Read message</summary><blockquote>{message.bodyText}</blockquote>
        </details> : null}
        {message.truncated ? <p className={styles.explanation}>Part of this message was omitted by the read limit. Open the original for the rest.</p> : null}
        {sample ? <p className={styles.explanation}>Sample message — there is no original email to open.</p>
          : href ? <a href={href} target="_blank" rel="noopener noreferrer">Open original email in Outlook ↗</a> : <p>Source link unavailable</p>}
        {copies.length ? <details className={styles.sources}><summary>{copies.length} additional mailbox {copies.length === 1 ? 'copy' : 'copies'}</summary>
          <p className={styles.explanation}>Same sender, subject, sent time and complete text.</p>
          {!sample ? copies.map(copy => <p key={copy.id}><a href={correspondenceSourceHref(copy.url) ?? undefined} target="_blank" rel="noopener noreferrer">Open other copy in Outlook ↗</a></p>) : null}
        </details> : null}
      </article>;
  }
  return <div className={styles.messages} aria-label="Customer email messages">
    {featured.map((group, index) => renderMessage(group, index === 0 ? 'Latest linked email' : 'Latest customer reply to a project email'))}
    {project.customerEmail && featured.length > 0 && !latestCustomer ? <p className={styles.explanation}>No incoming customer reply has been linked to this project in this limited check.</p> : null}
    {earlier.length ? <details className={styles.sources} open={earlierOpen} onToggle={event => { if (event.target === event.currentTarget) onEarlierOpen(event.currentTarget.open); }}>
      <summary>Earlier emails ({earlier.length})</summary><div className={styles.messages}>{earlier.map(group => renderMessage(group))}</div>
    </details> : null}
    {unconfirmed.length ? <details className={styles.sources} open={!latestCustomer ? true : undefined}>
      <summary>Customer emails — project match unconfirmed ({unconfirmed.length})</summary>
      {!featured.length ? <p className={styles.explanation}>We found customer emails, but have not confirmed which belong to this job.</p> : null}
      <div className={styles.messages}>{unconfirmedPreview.map(group => renderMessage(group, group === latestUnconfirmedCustomer ? 'Latest customer email — project match unconfirmed' : undefined))}</div>
      {unconfirmedEarlier.length ? <details className={styles.sources}><summary>More unconfirmed emails ({unconfirmedEarlier.length})</summary>
        <div className={styles.messages}>{unconfirmedEarlier.map(group => renderMessage(group))}</div>
      </details> : null}
    </details> : null}
    {!messages.length ? <p>No customer messages were returned. This does not mean there has been no correspondence.</p> : null}
  </div>;
}
