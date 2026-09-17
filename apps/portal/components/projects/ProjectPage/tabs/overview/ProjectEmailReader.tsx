import { splitProjectEmailText } from './projectEmailText';
import styles from './ProjectCorrespondenceCard.module.css';

export default function ProjectEmailReader({ text }: { text: string }) {
  const { latest, history } = splitProjectEmailText(text);
  return <div className={styles.emailReader}>
    <p className={styles.readerLabel}>{history.length ? 'Latest message' : 'Message'}</p>
    <div className={styles.readingPane} role="region" aria-label="Message text" tabIndex={0}>
      <blockquote>{latest}</blockquote>
    </div>
    {history.length ? <details className={styles.quotedHistory}>
      <summary>Earlier messages in this email ({history.length})</summary>
      <p className={styles.explanation}>Quoted history from this email. Earlier questions may have been resolved since.</p>
      {history.map((part, index) => <section key={index} className={styles.quotedMessage} aria-label={`Quoted message ${index + 1}`}>
        {part.header ? <p className={styles.quotedHeader}>{part.header}</p> : null}
        <div className={styles.readingPane} role="region" aria-label={`Quoted message ${index + 1} text`} tabIndex={0}>
          <blockquote>{part.body}</blockquote>
        </div>
      </section>)}
    </details> : null}
  </div>;
}
