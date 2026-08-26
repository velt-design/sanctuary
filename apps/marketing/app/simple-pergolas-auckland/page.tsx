import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import GuidedJourneyContext from '@/components/guided-journey/GuidedJourneyContext';
import {
  ActionGroup,
  Button,
  Container,
  Eyebrow,
  Heading,
  MarketingPage,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import ProjectFinderJourneyContext from '@/components/project-finder/ProjectFinderJourneyContext';
import GoogleReviewMark from '@/components/reviews/GoogleReviewMark';
import { GOOGLE_PLACE, featuredReviews } from '@/data/reviews';
import {
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext } from '@/lib/projectFinderContinuation';
import { getGoogleRating } from '@/lib/googleReviews';
import {
  simpleCoverBoundary,
  simpleCoverInclusions,
  simpleCoverOptions,
  simpleCoverStandard,
} from './content';
import SimplePergolaJourney from './SimplePergolaJourney';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './simple-pergolas-auckland.module.css';

const route = '/simple-pergolas-auckland';
const desktopHeroImage = '/images/simple-pergolas/pitched-03.webp';
const mobileHeroImage = '/images/simple-pergolas/pitched-11.webp';

export const metadata: Metadata = {
  title: { absolute: 'Simple Pitched Acrylic Pergolas | Sanctuary Pergolas' },
  description:
    'A straightforward pitched acrylic pergola, finished to the Sanctuary standard. Check whether your Auckland deck fits the Simple cover range.',
  robots: { index: true, follow: true },
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Cover the Space Without Losing Light',
    description:
      'A straightforward pitched acrylic pergola, finished to the Sanctuary standard.',
    images: [{
      url: desktopHeroImage,
      alt: 'Pitched acrylic pergola preserving daylight over an outdoor living space',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cover the Space Without Losing Light',
    description:
      'A straightforward pitched acrylic pergola, finished to the Sanctuary standard.',
    images: [desktopHeroImage],
  },
};

const simpleCoverReviews = ['Rob Ebert', 'Pierre and Tracy'].flatMap((author) => {
  const review = featuredReviews.find((candidate) => candidate.author === author);
  return review ? [review] : [];
});

function reviewInitials(author: string): string {
  const parts = author
    .trim()
    .split(/\s+/)
    .filter((part) => part.toLowerCase() !== 'and');

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

type SimplePergolasPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function SimplePergolasPage({
  searchParams,
}: SimplePergolasPageProps) {
  const params = searchParams ? await searchParams : {};
  const guidedContext = resolveGuidedJourneyContext('residential-cover', params);
  const projectFinderContext = guidedContext
    ? null
    : resolveProjectFinderJourneyContext('cover', params);
  const enquiryContext = guidedContext?.enquiryContext
    ?? projectFinderContext?.enquiryContext
    ?? {
      enquiryType: 'residential' as const,
      sourcePath: route,
      sourceComponent: 'embedded_form',
    };
  const googleReview = await getGoogleRating();
  const mobileHero = getImageProps({
    alt: 'Pitched acrylic pergola preserving daylight over an outdoor living space',
    fetchPriority: 'high',
    fill: true,
    loading: 'eager',
    sizes: '100vw',
    src: mobileHeroImage,
  });
  const desktopHero = getImageProps({
    alt: 'Pitched acrylic pergola preserving daylight over an outdoor living space',
    fetchPriority: 'high',
    fill: true,
    loading: 'eager',
    sizes: '(max-width: 760px) 100vw, 62vw',
    src: desktopHeroImage,
  });

  return (
    <MarketingPage
      className={styles.page}
      data-conversion-landing="simple-pergolas-auckland"
      data-indexing="index"
    >
      <section className={styles.hero} aria-labelledby="simple-pergola-title">
        <div className={styles.heroCopy}>
          <Eyebrow className={styles.heroEyebrow}>
            Pitched acrylic cover · Auckland
          </Eyebrow>
          <Heading
            as="h1"
            variant="page"
            id="simple-pergola-title"
            className={styles.heroTitle}
          >
            Cover the space without losing light.
          </Heading>
          <Text size="large" className={styles.heroIntro}>
            A straightforward pitched acrylic pergola, finished to the
            Sanctuary standard.
          </Text>
          <ActionGroup className={styles.heroActions}>
            <Button href="#price-your-cover">Price your Simple cover</Button>
          </ActionGroup>
          <dl className={styles.heroFacts} aria-label="Simple cover highlights">
            <div><dt>Live estimate</dt><dd>Plan + initial estimate</dd></div>
            <div><dt>Simple range</dt><dd>Ground or elevated</dd></div>
            <div><dt>Workmanship</dt><dd>10-year warranty</dd></div>
          </dl>
        </div>
        <figure className={styles.heroMedia}>
          <picture>
            <source media="(max-width: 760px)" srcSet={mobileHero.props.srcSet} />
            <img {...desktopHero.props} className={styles.heroImage} />
          </picture>
          <figcaption>
            <span>Fixed acrylic cover</span>
            <span>Daylight remains part of the space</span>
          </figcaption>
        </figure>
      </section>

      <SimplePergolaJourney sourceContext={enquiryContext}>
        <section
          className={styles.levelComparison}
          aria-labelledby="simple-level-comparison-title"
        >
          <Container width="wide" className={styles.levelComparisonContainer}>
            <header className={styles.levelComparisonHeader}>
              <Eyebrow>Built at either level</Eyebrow>
              <Heading id="simple-level-comparison-title">
                Ground level or elevated.
              </Heading>
            </header>
            <div className={styles.levelComparisonGrid}>
              <figure>
                <div className={styles.levelComparisonMedia}>
                  <Image
                    src="/images/simple-pergolas/pitched-01.webp"
                    alt="White pitched acrylic pergola covering a ground-level patio beside a weatherboard home"
                    fill
                    sizes="(max-width: 720px) 100vw, 50vw"
                  />
                </div>
                <figcaption>Ground-level cover</figcaption>
              </figure>
              <figure>
                <div className={styles.levelComparisonMedia}>
                  <Image
                    src="/images/simple-pergolas/pitched-10.webp"
                    alt="White pitched acrylic pergola attached above an elevated timber deck"
                    fill
                    sizes="(max-width: 720px) 100vw, 50vw"
                  />
                </div>
                <figcaption>Elevated-deck cover</figcaption>
              </figure>
            </div>
          </Container>
        </section>

        <GuidedJourneyContext context={guidedContext} />
        <ProjectFinderJourneyContext context={projectFinderContext} />

        <section className={styles.standard} aria-labelledby="sanctuary-standard-title">
        <div className={styles.standardMedia}>
          <Image
            src="/images/simple-pergolas/pitched-06.webp"
            alt="Black pitched acrylic pergola aligned with a dark-clad Auckland home"
            fill
            sizes="(max-width: 900px) 100vw, 56vw"
          />
          <span>Resolved as part of the home</span>
        </div>
        <div className={styles.standardCopy}>
          <Eyebrow>The Sanctuary standard</Eyebrow>
          <Heading id="sanctuary-standard-title">
            Simple form. Sanctuary finish.
          </Heading>
          <Text size="large">
            A focused product still deserves careful proportions, clean
            connections and a complete finish.
          </Text>
          <ol className={styles.standardList}>
            {simpleCoverStandard.map((item) => (
              <li key={item.number}>
                <span>{item.number}</span>
                <div><h3>{item.title}</h3><p>{item.text}</p></div>
              </li>
            ))}
          </ol>
          <div className={styles.inclusions}>
            <h3>Included in the proposal</h3>
            <ul>
              {simpleCoverInclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <small>The confirmed proposal records the exact project scope.</small>
          </div>
        </div>
      </section>

      <section className={styles.options} aria-labelledby="simple-options-title">
        <Container width="wide" className={styles.optionsGrid}>
          <div className={styles.optionsMedia}>
            <Image
              src="/images/simple-pergolas/pitched-08.webp"
              alt="Clear acrylic roof over an elevated deck with a garden outlook"
              fill
              sizes="(max-width: 900px) 100vw, 55vw"
            />
          </div>
          <div className={styles.optionsCopy}>
            <Eyebrow>Useful choices, kept simple</Eyebrow>
            <Heading id="simple-options-title">
              Make it suit the home.
            </Heading>
            <div className={styles.optionList}>
              {simpleCoverOptions.map((option) => (
                <article key={option.number}>
                  <span>{option.number}</span>
                  <div>
                    <h3>{option.title}</h3>
                    <p>{option.text}</p>
                    <small>{option.note}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className={styles.boundary} aria-labelledby="simple-boundary-title">
        <Container width="wide">
          <header className={styles.sectionIntro}>
            <div>
              <Eyebrow>Choose the right path</Eyebrow>
              <Heading id="simple-boundary-title">
                Simple or Custom?
              </Heading>
            </div>
            <Text size="large">
              Simple is a fixed roof with open sides, so wind-driven rain can
              still enter. More involved architecture belongs in Custom.
            </Text>
          </header>
          <div className={styles.boundaryGrid}>
            <article>
              <Eyebrow>Simple cover</Eyebrow>
              <h3>Choose Simple when</h3>
              <ul>{simpleCoverBoundary.simple.map((item) => <li key={item}>{item}</li>)}</ul>
              <Button href="#price-your-cover">Price your Simple cover</Button>
            </article>
            <article>
              <Eyebrow>Custom design</Eyebrow>
              <h3>Choose Custom when</h3>
              <ul>{simpleCoverBoundary.custom.map((item) => <li key={item}>{item}</li>)}</ul>
              <TextLink href="/custom-pergolas-auckland">Explore Custom design</TextLink>
            </article>
          </div>
        </Container>
      </section>

      <section className={styles.reviews} aria-labelledby="simple-reviews-title">
        <Container width="wide">
          <header className={styles.reviewsHeader}>
            <div className={styles.reviewsTitleGroup}>
              <Eyebrow>Customer experience</Eyebrow>
              <Heading id="simple-reviews-title">
                Thoughtful work, clearly delivered.
              </Heading>
            </div>
            <a
              className={styles.googleTrust}
              href={GOOGLE_PLACE.reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${googleReview.rating.toFixed(1)} out of 5 from ${googleReview.count} Google reviews`}
            >
              <GoogleReviewMark className={styles.googleMark} />
              <span>
                <strong>{googleReview.rating.toFixed(1)}</strong>
                <span className={styles.reviewStars} aria-hidden="true">★★★★★</span>
              </span>
              <span>{googleReview.count} Google reviews</span>
            </a>
          </header>
          <div className={styles.reviewGrid}>
            {simpleCoverReviews.map((review) => (
              <figure key={review.author}>
                <span className={styles.reviewQuote} aria-hidden="true">”</span>
                <span className={styles.reviewStars} aria-hidden="true">★★★★★</span>
                <blockquote>{review.quote}</blockquote>
                <figcaption>
                  <span className={styles.reviewAvatar} aria-hidden="true">
                    {reviewInitials(review.author)}
                  </span>
                  <span className={styles.reviewAuthor}>
                    <strong>{review.author}</strong>
                    <span><GoogleReviewMark className={styles.googleMark} />Google review</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>
      </SimplePergolaJourney>
    </MarketingPage>
  );
}
