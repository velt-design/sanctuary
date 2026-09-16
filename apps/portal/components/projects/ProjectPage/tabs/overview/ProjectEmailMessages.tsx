import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { correspondenceSourceHref, type ProjectCorrespondenceContext } from './projectCorrespondencePresentation';
import styles from './ProjectCorrespondenceCard.module.css';

export default function ProjectEmailMessages({ messages, sample }: {
  messages: NonNullable<ProjectCorrespondenceContext['messages']>; sample: boolean;
}) {
  return <div className={styles.messages} aria-label="Customer email messages">
    {messages.length ? [...messages].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt)).map(message => {
      const href = correspondenceSourceHref(message.url);
      const preview = message.bodyText.slice(0, 480);
      return <article key={message.id} className={styles.message}>
        <h3>{message.subject || 'No subject'}</h3>
        <p className={styles.explanation}>From {message.from} · {formatPortalDateTime(message.sentAt)}</p>
        <blockquote>{preview || 'Message text unavailable in this check.'}</blockquote>
        {message.bodyText.length > preview.length ? <details className={styles.sources}>
          <summary>Read message</summary><blockquote>{message.bodyText}</blockquote>
        </details> : null}
        {message.truncated ? <p className={styles.explanation}>Part of this message was omitted by the read limit. Open the original for the rest.</p> : null}
        {sample ? <p className={styles.explanation}>Sample message — there is no original email to open.</p>
          : href ? <a href={href} target="_blank" rel="noopener noreferrer">Open original email in Outlook ↗</a> : <p>Source link unavailable</p>}
      </article>;
    }) : <p>No customer messages were returned. This does not mean there has been no correspondence.</p>}
  </div>;
}
