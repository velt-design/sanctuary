import Image from 'next/image';
import Link from 'next/link';

type HeroSectionProps = {
  blurDataUrl: string;
};

export default function HomeHeroSection({ blurDataUrl }: HeroSectionProps) {
  return (
    <section className="home-hero" id="top" aria-labelledby="home-hero-heading">
      <Image
        src="/images/project-dairy-flat-01.jpg"
        alt="Gable pergola extending a Dairy Flat home beside a pool"
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
          Designed for New Zealand conditions, tailored on site, and installed by the Sanctuary team once your build is ready.
        </p>
        <div className="home-hero__actions" aria-label="Homepage actions">
          <Link href="/contact" className="home-hero__cta home-hero__cta--primary">
            Quick Estimate
          </Link>
          <Link href="/projects" className="home-hero__cta home-hero__cta--secondary">
            View projects
          </Link>
        </div>
      </div>
    </section>
  );
}
