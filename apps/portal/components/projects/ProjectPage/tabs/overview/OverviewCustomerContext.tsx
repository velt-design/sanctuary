import type { ProjectPageSnapshot } from '@/lib/projects/types';
import styles from './OverviewTab.module.css';

function joinValues(values: Array<string | null | undefined>): string {
  return values.map((value) => value?.trim()).filter(Boolean).join(' · ');
}

export default function OverviewCustomerContext({ project }: { project: ProjectPageSnapshot['project'] }) {
  const customer = joinValues([project.contactName, project.contactEmail, project.contactPhone]);
  const site = joinValues([project.siteAddress, project.region]);
  return (
    <section className={styles.contextCard} aria-labelledby="overview-customer-context-heading">
      <h2 id="overview-customer-context-heading">Customer context</h2>
      <dl className={styles.contextGrid}>
        <div>
          <dt>Customer</dt>
          <dd>{customer || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Site</dt>
          <dd>{site || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Project reference</dt>
          <dd>{project.quoteRef || 'Not allocated'}</dd>
        </div>
      </dl>
    </section>
  );
}
