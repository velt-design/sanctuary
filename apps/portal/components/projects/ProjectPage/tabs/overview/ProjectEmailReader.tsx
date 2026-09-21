import { splitProjectEmailText } from './projectEmailText';
import styles from './ProjectCorrespondenceCard.module.css';
import { useProjectEmailReadingState } from './ProjectEmailReadingState';

export default function ProjectEmailReader({ text, messageId }: { text: string; messageId: string }) {
  const reading = useProjectEmailReadingState();
  const historyKey = `history:${messageId}`;
  const { latest, history } = splitProjectEmailText(text);
  return <div className={styles.emailReader}>
    <p className={styles.readerLabel}>{history.length ? 'Latest message' : 'Message'}</p>
    <div className={styles.readingPane} role="region" aria-label="Message text" tabIndex={0}>
      <blockquote>{latest}</blockquote>
    </div>
    {history.length ? <details className={styles.quotedHistory} open={reading.open.has(historyKey)} onToggle={event => {
      if (event.target === event.currentTarget) reading.set(historyKey, event.currentTarget.open);
    }}>
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
