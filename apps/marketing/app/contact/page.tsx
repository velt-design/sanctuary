import Image from 'next/image';
import Link from 'next/link';
import { projects } from '@/data/projects';
import { getProductBySlug } from '@/data/products';
import { parseEnquiryContext } from '@/lib/enquiryContext';
import ContactEnquiryForm from './ContactEnquiryForm';
import { getEnquiryTypeFromAudience } from './enquiryRoute';
import './contact.css';

type ContactPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const warkworthProject = projects.find(
  (project) => project.slug === 'warkworth-outdoor-room',
) ?? projects[0]!;
const contactImage = warkworthProject.caseStudyHeroImage ?? warkworthProject.heroImage;

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : {};
  const routeContext = parseEnquiryContext(params);
  const sourceProject = routeContext.projectSlug
    ? projects.find((project) => project.slug === routeContext.projectSlug)
    : undefined;
  const sourceProduct = routeContext.productSlug
    ? getProductBySlug(routeContext.productSlug)
    : undefined;
  const inferredAudience = routeContext.enquiryType
    ?? (sourceProject
      ? sourceProject.type === 'Commercial' ? 'commercial' : 'residential'
      : undefined)
    ?? (sourceProduct ? 'residential' : undefined);
  const initialEnquiryType = getEnquiryTypeFromAudience(inferredAudience);
  const initialSourceContext = {
    ...(routeContext.sourcePath ? { sourcePath: routeContext.sourcePath } : {}),
    ...(routeContext.sourceComponent
      ? { sourceComponent: routeContext.sourceComponent }
      : {}),
    ...(sourceProject
      ? { projectSlug: sourceProject.slug, projectTitle: sourceProject.title }
      : {}),
    ...(sourceProduct
      ? { productSlug: sourceProduct.slug, productName: sourceProduct.name }
      : {}),
    hasEntryContext: Boolean(
      inferredAudience
      || sourceProject
      || sourceProduct,
    ),
  };

  return (
    <main className="contact-page" data-contact-page>
      <section className="contact-hero" aria-labelledby="contact-page-title">
        <div className="contact-shell contact-hero__layout">
          <div className="contact-hero__copy">
            <p className="contact-eyebrow">Start a conversation</p>
            <h1 id="contact-page-title">Tell us about the space you want to cover.</h1>
            <p>
              Sanctuary designs and installs custom fixed-roof pergolas around the
              home, the site and how the outdoor area will be used.
            </p>
            <a className="contact-action contact-action--primary" href="#contact-form">
              Start your project brief
            </a>
          </div>

          <figure className="contact-hero__figure">
            <div className="contact-hero__media">
              <Image
                src={contactImage.src}
                alt={contactImage.alt}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 50vw"
                style={{ objectFit: 'cover', objectPosition: contactImage.objectPosition }}
              />
            </div>
            <figcaption>
              <span>{warkworthProject.title}</span>
              <Link href={`/projects/${warkworthProject.slug}`}>View the project</Link>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="contact-workspace" aria-label="Project enquiry">
        <div className="contact-shell contact-workspace__layout">
          <ContactEnquiryForm
            key={[
              initialEnquiryType ?? 'chooser',
              initialSourceContext.projectSlug ?? '',
              initialSourceContext.productSlug ?? '',
            ].join(':')}
            initialEnquiryType={initialEnquiryType}
            initialSourceContext={initialSourceContext}
          />

          <aside className="contact-guidance" aria-labelledby="contact-guidance-title">
            <div>
              <p className="contact-eyebrow">A useful first brief</p>
              <h2 id="contact-guidance-title">Share what you know. Unsure is fine.</h2>
              <p>
                Location and rough dimensions help us understand the site. You can
                leave design choices open.
              </p>
            </div>

            <ol className="contact-guidance__list">
              <li>
                <span>01</span>
                <div>
                  <strong>Describe the outcome</strong>
                  <p>Tell us how you want to use the area and what currently limits it.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Add the site basics</strong>
                  <p>Share the suburb and approximate size if they are known.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>We review the next step</strong>
                  <p>We will identify the useful questions, options or site checks to discuss.</p>
                </div>
              </li>
            </ol>

            <div className="contact-guidance__direct">
              <p className="contact-eyebrow">Prefer to speak directly?</p>
              <a href="tel:+64228545633">022 854 5633</a>
              <a href="mailto:info@sanctuarypergolas.co.nz">
                info@sanctuarypergolas.co.nz
              </a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
