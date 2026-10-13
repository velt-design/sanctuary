import Image from 'next/image';
import Link from 'next/link';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import GuidedJourneyContext from '@/components/guided-journey/GuidedJourneyContext';
import ProjectFinderJourneyContext from '@/components/project-finder/ProjectFinderJourneyContext';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  ProcessSteps,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation';
import { projects } from '@/data/projects';
import {
  orderGuidedItemsBySlug,
  resolveGuidedJourneyContext,
  type GuidedJourneySearchParams,
} from '@/lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext } from '@/lib/projectFinderContinuation';
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import LandingSelector from './LandingSelector';
import { route, heroImage } from './landingSeo';
import ComparisonLink from './ComparisonLink';
import {
  faqItems,
  generalRoofPreference,
  investmentDrivers,
  planningLinks,
  residentialProcessSteps,
  residentialProjectProof,
} from './content';
import '../acrylic-roof-pergolas-auckland/acrylic-roof-pergolas-auckland.css';
import '../../components/seo-landing/seo-landing.css';
import './pergolas-auckland.css';

const baseProjectProof = residentialProjectProof.flatMap((proof) => {
  const project = projects.find((candidate) => candidate.slug === proof.slug);
  return project ? [{ ...proof, project }] : [];
});

type PergolasAucklandPageProps = {
  searchParams?: Promise<GuidedJourneySearchParams>;
};

export default async function PergolasAucklandPage({
  searchParams,
}: PergolasAucklandPageProps) {
  const params = searchParams ? await searchParams : {};
  const guidedContext = resolveGuidedJourneyContext(
    'residential-cover',
    params,
  );
  const projectFinderContext = guidedContext
    ? null
    : resolveProjectFinderJourneyContext('cover', params);
  const projectProof = orderGuidedItemsBySlug(
    baseProjectProof,
    guidedContext?.preferredProjectSlugs,
  );

  return (
    <main
      className="acrylic-landing pergolas-auckland"
      data-marketing-foundation-page
      data-seo-landing="pergolas-auckland"
    >


      <section
        className="acrylic-hero"
        aria-labelledby="pergolas-auckland-title"
        data-service-major-section="hero"
      >
        <Image
          src={heroImage}
          alt="Poolside gable pergola and outdoor room beside an Auckland home"
          fill
          priority
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 760px) 92vw, 50vw"
          className="acrylic-hero__image"
        />
        <div className="acrylic-hero__shade" aria-hidden="true" />
        <Container width="wide" className="acrylic-hero__content">
          <Eyebrow className="acrylic-eyebrow">
            Pergola design and installation in Auckland
          </Eyebrow>
          <Heading as="h1" variant="page" id="pergolas-auckland-title">
            Outdoor pergolas, designed and installed in Auckland.
          </Heading>
          <Text size="large" className="acrylic-hero__intro">
            A little shelter. More room to live outside. Find the roofline, light and proportions that suit your home.
          </Text>
          <div className="acrylic-hero__actions">
            <Button href="#explore-options">Explore styles &amp; pricing</Button>
            <TextLink href="#project-details">Discuss your project</TextLink>
          </div>
          <ul
            className="acrylic-hero__proof"
            aria-label="Sanctuary pergola approach"
          >
            <li>Designed for your site</li>
            <li>Built projects across Auckland</li>
            <li>One design and installation team</li>
          </ul>
          <p className="pergolas-auckland__hero-caption">Built by Sanctuary · Riverhead, Auckland</p>
        </Container>
      </section>

      <ComparisonLink />
      <GuidedJourneyContext context={guidedContext} />
      <ProjectFinderJourneyContext context={projectFinderContext} />

      <LandingSelector />

      <Section
        className="acrylic-section"
        aria-labelledby="completed-projects"
        id="project-evidence"
        data-service-major-section="proof"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">
              Built in Auckland
            </Eyebrow>
            <Heading id="completed-projects">
              Made for the home around it.
            </Heading>
          </header>
          <div className="acrylic-project-grid">
            {projectProof.map(({ project, label, summary, facts }) => (
              <Link
                href={`/projects/${project.slug}`}
                className="acrylic-project-card"
                key={project.slug}
              >
                <div className="acrylic-project-card__media">
                  <Image
                    src={project.heroImage.src}
                    alt={project.heroImage.alt}
                    fill
                    sizes="(max-width: 720px) 100vw, 50vw"
                    style={{
                      objectPosition: project.heroImage.objectPosition,
                    }}
                  />
                </div>
                <div className="acrylic-project-card__body">
                  <Eyebrow className="acrylic-eyebrow">{label}</Eyebrow>
                  <h3>{project.title}</h3>
                  <p className="acrylic-project-card__location">
                    {project.location} · {project.roof}
                  </p>
                  <p>{summary}</p>
                  <ul className="seo-landing__project-facts">
                    {facts.map((fact) => <li key={fact}>{fact}</li>)}
                  </ul>
                  <span>View project</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="acrylic-section__action">
            <Button href="/projects" variant="outline">
              View all projects
            </Button>
            <Button
              href="#project-details"
              className="pergolas-auckland__mobile-project-cta"
            >
              Send my brief
            </Button>
          </div>
        </Container>
      </Section>

      <Section
        className="acrylic-section"
        aria-labelledby="investment-drivers"
        data-service-major-section="investment"
      >
        <Container width="wide">
          <div className="acrylic-intro-grid">
            <div>
              <Eyebrow className="acrylic-eyebrow">
                Know what you are comparing
              </Eyebrow>
              <Heading id="investment-drivers">
                An estimate, then a confirmed scope.
              </Heading>
              <Link href="/pergola-cost-auckland">
                Read the cost guide
              </Link>
            </div>
            <div className="acrylic-price-grid">
              {investmentDrivers.map(({ title, text }) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section
        tone="warm"
        className="acrylic-section acrylic-section--process"
        aria-labelledby="clear-process"
        data-service-major-section="process"
      >
        <Container width="wide">
          <header className="acrylic-section__header acrylic-section__header--wide">
            <Eyebrow className="acrylic-eyebrow">
              The process
            </Eyebrow>
            <Heading id="clear-process">
              From brief to agreed scope.
            </Heading>
          </header>
          <ProcessSteps items={[...residentialProcessSteps]} />
        </Container>
      </Section>

          <Section
            tone="neutral"
            className="acrylic-section"
            aria-labelledby="continue-the-brief"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">Useful next guides</Eyebrow>
                <Heading id="continue-the-brief">
                  Explore the details that matter to you
                </Heading>
              </header>
              <div className="acrylic-form-grid">
                {planningLinks.map((guide) => (
                  <Link
                    className="acrylic-form-card"
                    href={guide.href}
                    key={guide.href}
                  >
                    <h3>{guide.title}</h3>
                    <p>{guide.text}</p>
                    <span>{guide.label}</span>
                  </Link>
                ))}
              </div>
            </Container>
          </Section>

          <Section
            tone="elevated"
            className="acrylic-section acrylic-section--faq"
            aria-labelledby="pergolas-auckland-faq"
          >
            <Container width="wide">
              <header className="acrylic-section__header acrylic-section__header--wide">
                <Eyebrow className="acrylic-eyebrow">
                  Questions worth resolving
                </Eyebrow>
                <Heading id="pergolas-auckland-faq">
                  Planning a pergola in Auckland
                </Heading>
              </header>
              <div className="acrylic-faq-list">
                {faqItems.map((item, index) => (
                  <details key={item.question}>
                    <summary>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <h3>{item.question}</h3>
                      <i aria-hidden="true" />
                    </summary>
                    <div>
                      {item.answer.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </Container>
          </Section>


      <Section
        id="project-details"
        tone="warm"
        className="acrylic-section acrylic-section--estimate"
        aria-label="Auckland pergola project enquiry form"
      >
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            initialEnquiryType="residential"
            sourceContext={guidedContext?.enquiryContext ?? projectFinderContext?.enquiryContext ?? {
              enquiryType: 'residential',
              sourcePath: route,
              sourceComponent: 'embedded_form',
            }}
            eyebrow="Project brief"
            directContact={{ intro: 'Prefer to talk?', phoneLabel: '022 854 5633', phoneHref: 'tel:+64228545633', emailLabel: 'info@sanctuarypergolas.co.nz', emailHref: 'mailto:info@sanctuarypergolas.co.nz' }}
            heading="Tell us about your project."
            intro="Tell us what you have in mind. Rough dimensions and photos help, but you can start without them."
            submitLabel="Send enquiry"
            messageLabel="Your project"
            messagePlaceholder="How will you use the space? What should the pergola improve?"
            briefFields={[
              {
                name: 'siteAddress',
                label: 'Project address',
                type: 'text',
                placeholder: 'Street address, if you are ready to share it',
                wide: true,
              },
              {
                name: 'intendedUse',
                label: 'Intended use',
                type: 'text',
                placeholder:
                  'For example: dining, cooking, poolside or everyday family use',
                wide: true,
              },
            ]}
            roofPreference={generalRoofPreference}
          />
        </Container>
      </Section>
    </main>
  );
}
