import { AlertBanner, Badge, Button, Card, DataStatePanel, LoadingSkeleton } from '@/components/ui/foundation';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { correspondenceSourceHref, type ProjectCorrespondenceContext } from './projectCorrespondencePresentation';
import styles from './ProjectCorrespondenceCard.module.css';

const topics = { agreement: 'Agreement evidence in emails', job_status: 'Job position', next_action: 'Suggested next step' };
const kinds = { recorded: 'AI summary of records', interpretation: 'AI interpretation', recommendation: 'Suggestion', unknown: 'Not established' };

export default function ProjectCorrespondenceCard({ context, state = 'not_connected', onRefresh }: {
  context?: ProjectCorrespondenceContext;
  state?: 'not_connected' | 'available' | 'loading' | 'ready' | 'stale' | 'error';
  onRefresh?: () => void;
}) {
  const sources = new Map(context?.sources.map((source) => [source.id, source]));
  const correspondence = context?.sources.filter((source) => source.association === 'customer_address_only') ?? [];
  return <Card title="Customer conversations" padding="compact" aria-label="Customer conversations"
    action={onRefresh && state !== 'loading' ? <Button variant="tertiary" size="small" onClick={onRefresh}>{state === 'available' ? 'Check conversations' : 'Check again'}</Button> : undefined}>
    <div className={styles.stack}>
      {state === 'not_connected' ? <p className={styles.explanation}>Customer emails are not connected to staff project pages yet. Team notes and portal events are available below.</p>
        : state === 'available' ? <p className={styles.explanation}>Check linked customer emails for a current, sourced summary. This reads correspondence and does not send a reply or change the project.</p>
        : state === 'loading' ? <LoadingSkeleton rows={3} label="Checking customer conversations" />
        : state === 'error' || !context ? <DataStatePanel state="unavailable" title="Conversations unavailable" description="The latest customer correspondence could not be checked. No agreement or next step is inferred." onRetry={onRefresh} />
        : <>
          {state === 'stale' ? <AlertBanner tone="warning" title="Earlier conversation summary">This summary is no longer current. Check again for new correspondence before changing the job.</AlertBanner> : null}
          <p className={styles.explanation}>Checked {formatPortalDateTime(context.observedAt)}. Emails are matched to the customer address and may concern another job. This is a limited search, not a complete conversation history.</p>
          <p className={styles.explanation}>Review the source before updating project work. Suggestions do not change the job or send an email.</p>
          <div className={styles.summaries}>
            {context.answer.sections.map((section) => {
              const cited = section.citations.map((citation) => ({ ...citation, source: sources.get(citation.sourceId) }));
              const supported = section.kind === 'unknown' || (cited.length > 0 && cited.every(({ source }) => source && correspondenceSourceHref(source.url)));
              return <section key={section.topic} className={styles.summary} aria-label={topics[section.topic]}>
                <details open={section.topic === 'job_status'}>
                <summary className={styles.heading}><h3>{topics[section.topic]}</h3><Badge tone={section.kind === 'unknown' ? 'warning' : 'neutral'}>{kinds[section.kind]}</Badge></summary>
                {supported ? <>
                  <p>{section.answer}</p>
                  {section.caveat ? <p className={styles.explanation}>{section.caveat}</p> : null}
                  {section.topic === 'next_action' && section.kind === 'recommendation' ? <p className={styles.explanation}>If this is the right next step, use the Project Work controls above to record it.</p> : null}
                  {cited.length ? <details className={styles.sources}><summary>View supporting sources ({cited.length})</summary>
                    {cited.map(({ sourceId, quote, source }, index) => source && correspondenceSourceHref(source.url) ? <div key={`${sourceId}-${index}`}>
                      <blockquote>{quote}</blockquote>
                      <a href={correspondenceSourceHref(source.url)!} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
                      <p className={styles.explanation}>{formatPortalDateTime(source.recordedAt)} · {source.association === 'customer_address_only' ? 'Customer email match; project not confirmed' : 'Project record'}{source.excerpted ? ' · excerpt only' : ''}</p>
                    </div> : null)}
                  </details> : null}
                </> : <p>The supporting source is unavailable. This summary cannot be relied on.</p>}
                </details>
              </section>;
            })}
          </div>
          <details className={styles.sources}>
            <summary>Linked customer emails ({correspondence.length})</summary>
            {correspondence.length ? <p className={styles.explanation}>The quotations above are available here. Opening the original in Outlook also requires access to that mailbox.</p> : null}
            {correspondence.length ? correspondence.map((source) => <p key={source.id}>
              {correspondenceSourceHref(source.url) ? <a href={correspondenceSourceHref(source.url)!} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : <span>Source link unavailable</span>}
              <span className={styles.sourceDate}>{formatPortalDateTime(source.recordedAt)}</span>
            </p>) : <p>No email source is included in this summary. This does not establish that no correspondence exists.</p>}
          </details>
          {context.limitations.length ? <details className={styles.sources}><summary>What this check does not establish</summary><ul>{context.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul></details> : null}
        </>}
    </div>
  </Card>;
}
