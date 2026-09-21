import { formatPortalDate, formatPortalDateTime, formatPortalTime } from '@/lib/format/portalDateTime';
import { correspondenceSourceHref, type ProjectCorrespondenceContext } from './projectCorrespondencePresentation';
import styles from './ProjectCorrespondenceCard.module.css';
import { projectEmailGroups, referencesProjectQuote, type EmailProjectContext } from './projectEmailGroups';
import { projectEmailPreview } from './projectEmailPreview';
import { splitProjectEmailText } from './projectEmailText';
import ProjectEmailReader from './ProjectEmailReader';

export default function ProjectEmailMessages({ messages, sample, project = {}, expanded, onExpand, earlierOpen, onEarlierOpen }: {
  messages: NonNullable<ProjectCorrespondenceContext['messages']>; sample: boolean;
  project?: EmailProjectContext; expanded: ReadonlySet<string>; onExpand: (id: string, open: boolean) => void;
  earlierOpen: boolean; onEarlierOpen: (open: boolean) => void;
}) {
  const { featured, earlier, latestCustomer, unconfirmed, latestUnconfirmedCustomer, unconfirmedPreview, unconfirmedEarlier } = projectEmailGroups(messages, project.customerEmail);
  const orderedFeatured = latestCustomer ? [latestCustomer, ...featured.filter(group => group !== latestCustomer)] : featured;
  function renderMessage({ message, copies }: (typeof featured)[number], label?: string) {
      const href = correspondenceSourceHref(message.url);
      const preview = projectEmailPreview(message.bodyText, message.from);
      const expandable = message.bodyText.trim() !== preview;
      const hasHistory = splitProjectEmailText(message.bodyText).history.length > 0;
      return <article key={message.id} className={styles.message}>
        {label ? <p className={styles.messageLabel}>{label}</p> : null}
        <h3>{message.subject || 'No subject'}</h3>
        <div className={styles.messageMeta}>
          <span className={styles.sender}>From {message.from}</span>
          <time dateTime={message.sentAt} title={formatPortalDateTime(message.sentAt)}>{formatPortalDate(message.sentAt)} · {formatPortalTime(message.sentAt)}</time>
        </div>
        {message.projectLink?.state === 'conflicting' ? <p className={styles.explanation}>References more than one project.</p> : null}
        {referencesProjectQuote(message, project.quoteRef) && !message.subject?.includes(project.quoteRef ?? '') ? <p className={styles.quoteMatch}>Quote {project.quoteRef}</p> : null}
        {expandable ? <details className={styles.sources} open={expanded.has(message.id)} onToggle={event => { if (event.target === event.currentTarget) onExpand(message.id, event.currentTarget.open); }}>
          <summary>Read message</summary><ProjectEmailReader text={message.bodyText} messageId={message.id} />
        </details> : null}
        {!(expandable && expanded.has(message.id)) ? <>
          <blockquote className={styles.messagePreview}>{preview || 'Message text unavailable in this check.'}{preview.length === 200 ? '…' : ''}</blockquote>
          {hasHistory ? <p className={styles.explanation}>Includes earlier conversation</p> : null}
        </> : null}
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
    {orderedFeatured.map(group => renderMessage(group, group === latestCustomer ? 'Latest customer reply to a project email' : 'Latest linked email'))}
    {project.customerEmail && featured.length > 0 && !latestCustomer ? <p className={styles.explanation}>No incoming customer reply has been linked to this project in this limited check.</p> : null}
    {earlier.length ? <details className={styles.sources} open={earlierOpen} onToggle={event => { if (event.target === event.currentTarget) onEarlierOpen(event.currentTarget.open); }}>
      <summary>Earlier emails ({earlier.length})</summary><div className={styles.messages}>{earlier.map(group => renderMessage(group))}</div>
    </details> : null}
    {unconfirmed.length ? <details className={styles.sources} open={!latestCustomer ? true : undefined}>
      <summary>Customer emails — project match unconfirmed ({unconfirmed.length})</summary>
      <p className={styles.explanation}>Matched by customer address; these may concern another job.</p>
      <div className={styles.messages}>{unconfirmedPreview.map(group => renderMessage(group, group === latestUnconfirmedCustomer ? 'Latest customer email — project match unconfirmed' : undefined))}</div>
      {unconfirmedEarlier.length ? <details className={styles.sources}><summary>More unconfirmed emails ({unconfirmedEarlier.length})</summary>
        <div className={styles.messages}>{unconfirmedEarlier.map(group => renderMessage(group))}</div>
      </details> : null}
    </details> : null}
    {!messages.length ? <p>No customer messages were returned. This does not mean there has been no correspondence.</p> : null}
  </div>;
}
