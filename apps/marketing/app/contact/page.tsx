import Image from 'next/image';
import Link from 'next/link';
import { projects } from '@/data/projects';
import { products } from '@/data/products';
import {
  parseEnquiryContext,
  type EnquiryContextSearchParams,
} from '@/lib/enquiryContext';
import ContactEnquiryForm from './ContactEnquiryForm';
import { getEnquiryTypeFromRouteValue } from './enquiryRoute';
import './contact.css';

type ContactPageProps = {
  searchParams?: Promise<EnquiryContextSearchParams>;
};

const warkworthProject = projects.find(
  (project) => project.slug === 'warkworth-outdoor-room',
) ?? projects[0]!;
const contactImage = warkworthProject.caseStudyHeroImage ?? warkworthProject.heroImage;

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : {};
  const enquiryContext = parseEnquiryContext(params, {
    projectSlugs: projects.map((project) => project.slug),
    productSlugs: products.map((product) => product.slug),
  });
  const initialEnquiryType = getEnquiryTypeFromRouteValue(
    enquiryContext.enquiryType,
  );
  const sourceProject = projects.find(
    (project) => project.slug === enquiryContext.sourceProject,
  );
  const sourceProduct = products.find(
    (product) => product.slug === enquiryContext.sourceProduct,
  );

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
            key={`${initialEnquiryType ?? 'chooser'}-${enquiryContext.sourceProject ?? ''}-${enquiryContext.sourceProduct ?? ''}`}
            initialEnquiryType={initialEnquiryType}
            initialContext={enquiryContext}
            sourceProjectLabel={sourceProject?.title}
            sourceProductLabel={sourceProduct?.name}
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
