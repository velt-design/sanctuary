'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation';
import styles from './enquiry-journeys.module.css';

const journeys = [['configured', 'Configured pergola'], ['bespoke', 'Bespoke residential'], ['commercial', 'Commercial'], ['professional', 'Professional']] as const;
export default function EnquiryJourneysPreview({ endpoint = '/api/staff/v1/email-previews/website-autoresponder' }: { endpoint?: string }) {
  const [journey, setJourney] = useState<string>('configured');
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; htmlLight: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setError(false);
    fetch(`${endpoint}?variant=experience-${journey}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { const layout = (data.data ?? data).layouts?.[0]; if (!layout) throw new Error(); setPreview(layout); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [endpoint, journey]);
  return <section className={styles.panel} aria-label="Proposed enquiry journeys">
    <h2 >Proposed enquiry journeys</h2>
    <p className={styles.description}>Four distinct confirmations. Preview only until the production email switch is enabled.</p>
    <div className={styles.choices}>{journeys.map(([key, label]) => <Button type="button" key={key} variant={journey === key ? 'primary' : 'secondary'} aria-pressed={journey === key} onClick={() => setJourney(key)}>{label}</Button>)}</div>
    <label className={styles.size}><input type="checkbox" checked={mobile} onChange={e => setMobile(e.target.checked)} />Mobile email width</label>
    {error ? <p role="alert">The email preview could not load. Choose a journey to try again.</p> : !preview ? <p role="status">Loading preview…</p> : <>
      <p className={styles.subject}><strong>Subject:</strong> {preview.subject}</p>
      <iframe title={`${journey} enquiry confirmation`} sandbox="" srcDoc={preview.htmlLight} className={styles.frame} style={{ width: mobile ? 390 : 760 }} />
    </>}
  </section>;
}
