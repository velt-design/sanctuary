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
            <p className="contact-eyebrow">Project enquiry</p>
            <h1 id="contact-page-title">Tell us about your project.</h1>
            <p>
              Share the site, intended use and what you know so far.
            </p>
            <a className="contact-action contact-action--primary" href="#contact-form">
              Send a project brief
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
              <p className="contact-eyebrow">Keep it simple</p>
              <h2 id="contact-guidance-title">Photos and rough dimensions help.</h2>
              <p>
                Leave design choices open if you are unsure.
              </p>
            </div>

            <div className="contact-guidance__direct">
              <p className="contact-eyebrow">Contact Sanctuary</p>
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
