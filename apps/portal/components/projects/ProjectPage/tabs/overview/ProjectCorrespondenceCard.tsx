"use client";

import { useEffect } from 'react';
import { AlertBanner, Badge, Button, Card, DataStatePanel, LoadingSkeleton } from '@/components/ui/foundation';
import type { EmailProjectContext } from './projectEmailGroups';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { correspondenceSourceHref, type ProjectCorrespondenceContext } from './projectCorrespondencePresentation';
import styles from './ProjectCorrespondenceCard.module.css';
import ProjectEmailMessages from './ProjectEmailMessages';
import { useProjectEmailReadingState } from './ProjectEmailReadingState';

const topics = { agreement: 'Agreement evidence in emails', job_status: 'Job position', next_action: 'Suggested next step' };
const kinds = { recorded: 'AI summary of records', interpretation: 'AI interpretation', recommendation: 'Suggestion', unknown: 'Not established' };
const safeMailFailures = new Set([
  'Outlook returned more data than this check permits.',
  'Outlook returned message data that could not be safely read.',
  'Outlook could not complete the message request.',
  'The hourly mailbox check limit has been reached. Try again later.',
  'The Outlook connection is not ready for a message check.',
  'Mailbox checks are paused by the connection controls.',
]);

export default function ProjectCorrespondenceCard({ context, state = 'not_connected', onRefresh, onAnalyze, sample = false, project }: {
  context?: ProjectCorrespondenceContext;
  state?: 'not_connected' | 'available' | 'loading' | 'refreshing' | 'ready' | 'stale' | 'error';
  onRefresh?: () => void;
  onAnalyze?: () => void;
  sample?: boolean;
  project?: EmailProjectContext;
}) {
  const reading = useProjectEmailReadingState();
  const expanded = new Set([...reading.open].filter(key => key.startsWith('message:')).map(key => key.slice(8)));
  const earlierOpen = reading.open.has('earlier');
  // The deployed receiver preserves this explicit failure limitation even when
  // project records are available. An empty mail array alone is not a failure.
  const mailUnavailable = context?.limitations.includes('Outlook correspondence is unavailable or has not been checked.') === true;
  const mailFailure = context?.limitations.find(value => safeMailFailures.has(value));
  useEffect(() => {
    if (state === 'error' || state === 'not_connected' || state === 'available' || mailUnavailable) reading.clear();
  }, [state, mailUnavailable, reading.clear]);
  const onExpand = (id: string, open: boolean) => reading.set(`message:${id}`, open);
  const setEarlierOpen = (open: boolean) => reading.set('earlier', open);
  const sources = new Map(context?.sources.map((source) => [source.id, source]));
  const correspondence = context?.sources.filter((source) => source.association === 'customer_address_only').sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) ?? [];
  return <Card className={styles.card} id="customer-emails" tabIndex={-1} title="Customer emails" padding="compact" aria-label="Customer conversations"
    action={onRefresh && state !== 'loading' && state !== 'refreshing' ? <Button variant="tertiary" size="small" onClick={onRefresh}>{state === 'available' ? 'Check conversations' : 'Check again'}</Button> : undefined}>
    <div className={styles.stack}>
      {state === 'not_connected' ? <p className={styles.explanation}>Customer emails are not connected to staff project pages yet. Team notes and portal events are available below.</p>
        : state === 'available' ? <p className={styles.explanation}>Check linked customer emails for a current, sourced summary. This reads correspondence and does not send a reply or change the project.</p>
        : state === 'refreshing' ? <p className={styles.explanation} role="status">A mailbox check is already running or waiting to retry. Checking for its result shortly.</p>
        : state === 'loading' && !context ? <LoadingSkeleton rows={3} label="Checking customer conversations" />
        : state === 'error' || !context || mailUnavailable ? <DataStatePanel state="unavailable" title="Conversations unavailable" description={`${mailFailure ?? 'The latest customer correspondence could not be checked.'} No agreement or next step is inferred.`} onRetry={onRefresh} />
        : <>
          {context.snapshot ? <p className={styles.explanation} role="status">
            Emails checked {formatPortalDateTime(context.snapshot.checkedAt)}.
            {state === 'loading' ? ' Checking for newer emails…' : context.snapshot.state === 'saved' ? ' Showing saved emails; newer messages may be missing.' : ''}
          </p> : state === 'stale' ? <AlertBanner tone="warning" title="Earlier conversation summary">This summary is no longer current. Check again for new correspondence before changing the job.</AlertBanner> : null}
          {sample ? <p className={styles.explanation}>Sample email excerpts. Your real Outlook emails are not connected to this preview.</p> : null}
          {context.messages ? <ProjectEmailMessages messages={context.messages} sample={sample} project={project} expanded={expanded} onExpand={onExpand} earlierOpen={earlierOpen} onEarlierOpen={setEarlierOpen} /> : <div className={styles.messages} aria-label="Email excerpts">
            {correspondence.length ? correspondence.map((source) => {
              const href = correspondenceSourceHref(source.url);
              const quotes = [...new Set(context.answer.sections.flatMap(section => section.citations.filter(citation => citation.sourceId === source.id).map(citation => citation.quote)))];
              return <article key={source.id} className={styles.message}>
                <h3>{source.title}</h3>
                <p className={styles.explanation}>{formatPortalDateTime(source.recordedAt)}</p>
                {href && quotes.length ? quotes.map(quote => <blockquote key={quote}>{quote}</blockquote>) : <p>Email text is unavailable in this check.</p>}
                {sample ? <p className={styles.explanation}>Sample message — there is no original email to open.</p> : href ? <a href={href} target="_blank" rel="noopener noreferrer">Open original email in Outlook ↗</a> : <p>Source link unavailable</p>}
              </article>;
            }) : <p>No email excerpts were returned. This does not mean there has been no correspondence.</p>}
          </div>}
          {context.analysisAvailable === false ? (onAnalyze ? <Button variant="tertiary" size="small" onClick={onAnalyze}>Ask AI to interpret these emails</Button> : null) : <details className={styles.sources}>
          <summary>AI interpretation and suggestions</summary>
          <p className={styles.explanation}>Review the source before updating project work. Suggestions do not change the job or send an email.</p>
          <div className={styles.summaries}>
            {context.answer.sections.map((section) => {
              const cited = section.citations.map((citation) => ({ ...citation, source: sources.get(citation.sourceId) }));
              const supported = section.kind === 'unknown' || (cited.length > 0 && cited.every(({ source }) => source && correspondenceSourceHref(source.url)));
              return <section key={section.topic} className={styles.summary} aria-label={topics[section.topic]}>
                <details>
                <summary className={styles.heading}><h3>{topics[section.topic]}</h3><Badge tone={section.kind === 'unknown' ? 'warning' : 'neutral'}>{kinds[section.kind]}</Badge></summary>
                {supported ? <>
                  <p>{section.answer}</p>
                  {section.caveat ? <p className={styles.explanation}>{section.caveat}</p> : null}
                  {section.topic === 'next_action' && section.kind === 'recommendation' ? <p className={styles.explanation}>If this is the right next step, use the Project Work controls above to record it.</p> : null}
                  {cited.length ? <details className={styles.sources}><summary>View supporting sources ({cited.length})</summary>
                    {cited.map(({ sourceId, quote, source }, index) => source && correspondenceSourceHref(source.url) ? <div key={`${sourceId}-${index}`}>
                      <blockquote>{quote}</blockquote>
                      {sample ? <span>{source.title}</span> : <a href={correspondenceSourceHref(source.url)!} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>}
                      <p className={styles.explanation}>{formatPortalDateTime(source.recordedAt)} · {source.association === 'customer_address_only' ? 'Customer email match; project not confirmed' : 'Project record'}{source.excerpted ? ' · excerpt only' : ''}</p>
                    </div> : null)}
                  </details> : null}
                </> : <p>The supporting source is unavailable. This summary cannot be relied on.</p>}
                </details>
              </section>;
            })}
          </div>
          </details>}
          <details className={styles.sources}><summary>About these email excerpts</summary>
            <p className={styles.explanation}>Linked replies belong to a project email thread, which may also discuss other work. Unconfirmed emails are matched only by customer address.</p>
            <p className={styles.explanation}>Checked {formatPortalDateTime(context.observedAt)}. This is a limited search, not a complete conversation history. Opening the original in Outlook requires access to that mailbox.</p>
            <ul>{context.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
          </details>
        </>}
    </div>
  </Card>;
}
