import Image from 'next/image';
import Link from 'next/link';
import ReviewBadge from '@/components/reviews/ReviewBadge';

type HeroSectionProps = {
  blurDataUrl: string;
  reviewRating: number;
  reviewCount: number;
};

export default function HomeHeroSection({ blurDataUrl, reviewRating, reviewCount }: HeroSectionProps) {
  return (
    <section className="home-hero" id="top" aria-labelledby="home-hero-heading">
      <Image
        src="/images/riverhead-gable-01.jpg"
        alt="Riverhead gable pergola with timber ceiling overlooking a green landscape and pool"
        fill
        loading="eager"
        fetchPriority="high"
        quality={75}
        placeholder="blur"
        blurDataURL={blurDataUrl}
        sizes="100vw"
        className="home-hero__image"
      />
      <div className="home-hero__shade" aria-hidden="true" />

      <div className="home-hero__inner">
        <p className="home-hero__eyebrow">Sanctuary Pergolas</p>
        <h1 id="home-hero-heading" className="home-hero__title">
          Architectural pergolas tailored to Kiwi homes.
        </h1>
        <p className="home-hero__copy">
          Designed around the home and site conditions, tailored for the agreed project, and installed by the Sanctuary team once the build is ready.
        </p>
        <div className="home-hero__actions" aria-label="Homepage actions">
          <Link href="/contact" className="home-hero__cta home-hero__cta--primary">
            Quick Estimate
          </Link>
          <Link href="/projects" className="home-hero__cta home-hero__cta--secondary">
            View projects
          </Link>
        </div>
        <ReviewBadge
          rating={reviewRating}
          count={reviewCount}
          variant="onDark"
          className="home-hero__reviews mt-5"
        />
      </div>
    </section>
  );
}
