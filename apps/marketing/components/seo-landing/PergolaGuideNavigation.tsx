import Link from 'next/link';
import { findPergolaGuide, pergolaGuideEditorialReview } from '../../data/pergolaGuides';
import { getGuideDecisionLinks } from './guideDecisionLinks';
import DecisionTrackingRegion from '../journey/DecisionTrackingRegion';

export default function PergolaGuideNavigation({ route }: { route: string }) {
  const current = findPergolaGuide(route);
  const related = getGuideDecisionLinks(route);
  if (!current || !related) return null;
  const [first, second] = related;

  return (
    <DecisionTrackingRegion source="guide_navigation"><div className="seo-guide-navigation">
      <nav className="seo-guide-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/pergola-guides">Pergola guides</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current.title}</span>
      </nav>
      <nav className="seo-guide-progression" aria-label="Related planning decisions">
          <Link href={first.href} data-journey-action="compare" data-journey-destination={first.href.startsWith('/products') ? 'product' : 'planning_content'}>
            <small>{first.purpose}</small>
            <span>{first.label}</span>
          </Link>
        <Link href="/pergola-guides" className="seo-guide-progression__hub">
          <small>Planning library</small>
          <span>All topics</span>
        </Link>
          <Link href={second.href} className="seo-guide-progression__next" data-journey-action="compare" data-journey-destination={second.href.startsWith('/products') ? 'product' : 'planning_content'}>
            <small>{second.purpose}</small>
            <span>{second.label}</span>
          </Link>
      </nav>
      <p className="seo-guide-review">
        <span>Editorial review: {pergolaGuideEditorialReview.reviewer}</span>
        <time dateTime={pergolaGuideEditorialReview.date}>{pergolaGuideEditorialReview.dateLabel}</time>
        <span>{pergolaGuideEditorialReview.note}</span>
      </p>
    </div></DecisionTrackingRegion>
  );
}
