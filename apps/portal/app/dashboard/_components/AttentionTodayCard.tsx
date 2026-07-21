import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import type { DashboardAttentionItem } from '@/lib/dashboard/types';
import dash from '../dashboard.module.css';

export default function AttentionTodayCard({ items }: { items: DashboardAttentionItem[] }) {
  return (
    <section className={`${styles.section} ${dash.card} ${dash.attentionCard}`} aria-label="Attention Today">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>Attention Today</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Live operational counts.</div>
        </div>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody} ${dash.cardBodyNoScroll}`}>
        <ul className={dash.attentionList}>
          {items.map((item) => (
            <li key={item.key}>
              <ProjectsIndexLink className={dash.attentionItem} href={item.href} data-tone={item.tone}>
                <span className={dash.attentionCount}>{item.count}</span>
                <span className={dash.attentionCopy}>
                  <strong>{item.label}</strong>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </span>
                <span className={dash.rowArrow} aria-hidden="true">→</span>
              </ProjectsIndexLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
