import {
  PORTAL_INSTANT_ROUTE_DEFINITIONS,
  type PortalInstantRoute,
} from '@/lib/portalInstantRoutes';
import styles from './PortalRoutePendingFrame.module.css';

export default function PortalRoutePendingFrame({
  route,
  label,
}: {
  route: PortalInstantRoute;
  label?: string | null;
}) {
  const definition = PORTAL_INSTANT_ROUTE_DEFINITIONS[route];
  const title = route === 'project-detail' && label?.trim() ? label.trim() : definition.title;

  return (
    <main
      className={styles.page}
      data-portal-instant-shell={route}
      data-portal-instant-shell-state="pending"
      data-project-route-pending={route === 'project-detail' ? 'true' : undefined}
      aria-busy="true"
    >
      <header className={styles.header}>
        {route === 'project-detail' ? <span className={styles.eyebrow}>Projects</span> : null}
        <h1>{title}</h1>
        <p>{definition.description}</p>
      </header>
      <p className={styles.status} role="status">{definition.description}</p>
      <div className={styles.structure} aria-hidden="true">
        <span /><span /><span />
      </div>
    </main>
  );
}
