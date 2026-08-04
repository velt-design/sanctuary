import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
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
import { featuredReviews } from '@/data/reviews';
import {
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext } from '@/lib/projectFinderContinuation';
import {
  simpleCoverBoundary,
  simpleCoverFitCriteria,
  simpleCoverInclusions,
  simpleCoverOptions,
  simpleCoverRoofPreference,
  simpleCoverStandard,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import styles from './simple-pergolas-auckland.module.css';

const route = '/simple-pergolas-auckland';
const desktopHeroImage = '/images/simple-pergolas/pitched-03.webp';
const mobileHeroImage = '/images/simple-pergolas/pitched-11.webp';

export const metadata: Metadata = {
  title: { absolute: 'Simple Pitched Acrylic Pergolas | Sanctuary Pergolas' },
  description:
    'A straightforward pitched acrylic pergola, finished to the Sanctuary standard. Check whether your Auckland deck fits the Simple cover range.',
  robots: { index: false, follow: true },
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
      data-indexing="noindex"
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
            <Button href="#initial-estimate">Get an initial estimate</Button>
            <TextLink href="#right-fit">Check if your deck fits</TextLink>
          </ActionGroup>
          <dl className={styles.heroFacts} aria-label="Simple cover highlights">
            <div><dt>Ground level</dt><dd>Up to 30 m²</dd></div>
            <div><dt>Elevated deck</dt><dd>Up to 20 m²</dd></div>
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

      <GuidedJourneyContext context={guidedContext} />
      <ProjectFinderJourneyContext context={projectFinderContext} />

      <section
        className={styles.fit}
        id="right-fit"
        aria-labelledby="simple-fit-title"
        data-simple-price-integration="fit-section"
      >
        <Container width="wide">
          <header className={styles.sectionIntro}>
            <div>
              <Eyebrow>Does your deck fit?</Eyebrow>
              <Heading id="simple-fit-title">
                Clear limits make the first decision easy.
              </Heading>
            </div>
            <Text size="large">
              Simple describes the project conditions—not the quality of the
              finished pergola.
            </Text>
          </header>

          <div className={styles.fitLevels}>
            <article>
              <span>Ground-level deck</span>
              <strong>30</strong>
              <p>square metres maximum</p>
            </article>
            <article>
              <span>Elevated or first-floor deck</span>
              <strong>20</strong>
              <p>square metres maximum</p>
            </article>
          </div>

          <div className={styles.fitCriteria}>
            {simpleCoverFitCriteria.map((criterion) => (
              <article key={criterion.label}>
                <span>{criterion.label}</span>
                <h3>{criterion.value}</h3>
                <p>{criterion.text}</p>
              </article>
            ))}
          </div>

          <div className={styles.fitMedia}>
            <figure>
              <Image
                src="/images/simple-pergolas/pitched-01.webp"
                alt="White pitched acrylic pergola covering a ground-level patio beside a weatherboard home"
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <figcaption>Ground-level cover</figcaption>
            </figure>
            <figure>
              <Image
                src="/images/simple-pergolas/pitched-10.webp"
                alt="White pitched acrylic pergola attached above an elevated timber deck"
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <figcaption>Elevated-deck cover</figcaption>
            </figure>
          </div>

          <p className={styles.fitCaveat}>
            These are Sanctuary’s Simple cover product limits, not a consent
            or structural promise. The site, connection, exposure and approval
            pathway still need to be confirmed.
          </p>
        </Container>
      </section>

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
              <Eyebrow>A focused product</Eyebrow>
              <Heading id="simple-boundary-title">
                Know when Simple is the right answer.
              </Heading>
            </div>
            <Text size="large">
              The roof is fixed and open sides can still admit wind-driven
              rain. If the architecture or structure drives the brief, Custom
              design is the better starting point.
            </Text>
          </header>
          <div className={styles.boundaryGrid}>
            <article>
              <Eyebrow>Simple cover</Eyebrow>
              <h3>Keep this pathway when</h3>
              <ul>{simpleCoverBoundary.simple.map((item) => <li key={item}>{item}</li>)}</ul>
              <Button href="#initial-estimate">Start a Simple cover estimate</Button>
            </article>
            <article>
              <Eyebrow>Custom design</Eyebrow>
              <h3>Move to Custom when</h3>
              <ul>{simpleCoverBoundary.custom.map((item) => <li key={item}>{item}</li>)}</ul>
              <TextLink href="/custom-pergolas-auckland">Explore Custom design</TextLink>
            </article>
          </div>
        </Container>
      </section>

      <section className={styles.reviews} aria-labelledby="simple-reviews-title">
        <Container width="wide">
          <header className={styles.reviewsHeader}>
            <Eyebrow>Customer experience</Eyebrow>
            <Heading id="simple-reviews-title">
              Built to feel good—and feel straightforward.
            </Heading>
          </header>
          <div className={styles.reviewGrid}>
            {simpleCoverReviews.map((review) => (
              <figure key={review.author}>
                <blockquote>“{review.quote}”</blockquote>
                <figcaption><strong>{review.author}</strong><span>Five-star Google review</span></figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      <section
        className={styles.estimate}
        id="initial-estimate"
        aria-label="Simple pergola initial estimate enquiry"
      >
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={guidedContext?.enquiryContext ?? projectFinderContext?.enquiryContext ?? {
              enquiryType: 'residential',
              sourcePath: route,
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Initial estimate"
            heading="Get an initial Simple cover estimate."
            intro="Send your suburb, approximate size, deck level and a few photos. We’ll confirm whether the project fits this pathway and what is needed next."
            submitLabel="Request my initial estimate"
            successHeading="Estimate request sent."
            successMessage="We’ll review the space and come back to you with the most useful next step."
            messageLabel="What do you want the cover to change?"
            messagePlaceholder="For example: cover the deck, retain daylight at the kitchen and allow for a blind on the western side."
            briefFields={[
              {
                name: 'deckLevel',
                label: 'Deck level',
                type: 'select',
                options: [
                  'Ground-level deck or patio',
                  'Elevated or first-floor deck',
                  'Unsure',
                ],
                wide: true,
              },
              {
                name: 'sideProtection',
                label: 'Side protection',
                type: 'select',
                options: [
                  'Roof only',
                  'Roof with one side blind',
                  'Roof with blinds on more than one side',
                  'Unsure: please recommend an arrangement',
                ],
                wide: true,
              },
            ]}
            roofPreference={simpleCoverRoofPreference}
          />
        </Container>
      </section>
    </MarketingPage>
  );
}
