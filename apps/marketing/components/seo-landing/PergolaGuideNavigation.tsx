import Link from 'next/link';
import { findPergolaGuide, pergolaGuideEditorialReview, pergolaGuides } from '@/data/pergolaGuides';

export default function PergolaGuideNavigation({ route }: { route: string }) {
  const currentIndex = pergolaGuides.findIndex((guide) => guide.href === route);
  const current = findPergolaGuide(route);

  if (!current || currentIndex < 0) return null;

  const previous = pergolaGuides[currentIndex - 1];
  const next = pergolaGuides[currentIndex + 1];

  return (
    <div className="seo-guide-navigation">
      <nav className="seo-guide-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/pergola-guides">Pergola guides</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current.title}</span>
      </nav>
      <nav className="seo-guide-progression" aria-label="Pergola guide progression">
        {previous ? (
          <Link href={previous.href} rel="prev">
            <small>Previous guide</small>
            <span>{previous.number} {previous.title}</span>
          </Link>
        ) : <span className="seo-guide-progression__empty" aria-hidden="true" />}
        <Link href="/pergola-guides" className="seo-guide-progression__hub">
          <small>{current.label}</small>
          <span>{current.number} of {String(pergolaGuides.length).padStart(2, '0')}</span>
        </Link>
        {next ? (
          <Link href={next.href} rel="next" className="seo-guide-progression__next">
            <small>Next guide</small>
            <span>{next.number} {next.title}</span>
          </Link>
        ) : <span className="seo-guide-progression__empty" aria-hidden="true" />}
      </nav>
      <p className="seo-guide-review">
        <span>Editorial review: {pergolaGuideEditorialReview.reviewer}</span>
        <time dateTime={pergolaGuideEditorialReview.date}>{pergolaGuideEditorialReview.dateLabel}</time>
        <span>{pergolaGuideEditorialReview.note}</span>
      </p>
    </div>
  );
}
