import type { Metadata } from 'next';
import HomePageClient, {
  type HomePageContent,
} from '@/components/home/HomePageClient';
import { projects } from '@/data/projects';
import { getGoogleRating } from '@/lib/googleReviews';
import './home.css';
import './projects/projects.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'Sanctuary Pergolas',
    description: 'Architectural aluminium pergolas tailored to Kiwi homes.',
  },
};

// Simple neutral blur placeholder for LCP images.
const BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAGElEQVQYV2NkYGD4z0AkYGBg+P8fA4YBAJ3pC3xwV0KpAAAAAElFTkSuQmCC';

const featureItems: HomePageContent['featureItems'] = [
  {
    label: 'Project-specific installation',
    bubble: 'The on-site sequence is confirmed for the agreed design, access and site conditions.',
  },
  {
    label: 'Current programme confirmed',
    bubble: 'Design, production and installation timing is confirmed against the actual scope and current schedule.',
  },
  {
    label: 'Structure checked to the site',
    bubble: 'Loads, exposure, supports and any required engineering are resolved for the completed design.',
  },
  {
    label: '4 roof styles',
    bubble: "Choose pitched, gable, hip, or box-perimeter to suit your home's roofline.",
  },
  {
    label: 'Written warranty details',
    bubble: 'Applicable workmanship and product warranty terms are identified for the agreed project scope.',
  },
];

const processSteps: HomePageContent['processSteps'] = [
  { title: 'Enquiry', desc: 'Reach out by phone or email with your project.' },
  { title: 'Quick estimate', desc: 'We provide a ballpark based on size and style.' },
  {
    title: 'Site visit & design advice',
    desc: 'If the range suits, we visit, measure, and discuss how it will work best for your site.',
  },
  { title: 'Design sign-off', desc: 'We present a design for you to review and approve.' },
  {
    title: 'Deposit & scheduling',
    desc: 'Pay the deposit to secure the agreed production and installation programme.',
  },
  {
    title: 'On-site build',
    desc: 'We install the pergola to the agreed design and project-specific site sequence.',
  },
  {
    title: 'Completion',
    desc: 'We run through care, warranty details and final checks with you.',
  },
];

// ~100-word copy for each process step (aligned by index).
const copyTexts: HomePageContent['copyTexts'] = [
  'Tell us how you use the space, share a few photos and rough sizes. We confirm feasibility and flag any consent or engineering requirements before booking a visit.',
  'We price the best-fit style from your photos and dimensions, including structure, roofing and options. We explain cost drivers and alternatives. If the numbers work, we book a measured visit to refine scope.',
  'We visit your site, measure carefully and talk through how you want to use the space. We look at the size and layout, the style of your home and key views from inside and out. We then work through roof options, including timber, acrylic or a combination, to suit your goals for the space and the look of the pergola.',
  'We deliver a clear design pack with drawings, key dimensions, beam sizes, roof fall and finishes. Lighting and screens are integrated. Approval locks scope for fabrication and a smooth installation.',
  'Your deposit secures the agreed production slot and materials. The team confirms the current programme for the completed scope and keeps the site start visible as preparation progresses.',
  'We protect surfaces, set out posts and beams, check fixings and complete the house junction to the agreed design. Wiring is concealed where the documented structure and trade scope allow it.',
  "We provide the current care guidance and written warranty terms that apply to the agreed workmanship and selected products. Before we leave, we complete the final checks and make sure you know how to get in touch if anything needs attention.",
];

const featuredProjectSlugs = [
  'warkworth-outdoor-room',
  'dairy-flat-estate',
  'tindalls-bay-pavilion',
  'velskov-forest',
  'goodhome-commercial-terrace',
];

const featuredProjects: HomePageContent['featuredProjects'] = featuredProjectSlugs.flatMap((slug) => {
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) return [];

  return [{
    slug: project.slug,
    title: project.title,
    location: project.location,
    heroImage: project.heroImage,
  }];
});

export default async function HomePage() {
  const review = await getGoogleRating();

  return (
    <HomePageClient
      featureItems={featureItems}
      processSteps={processSteps}
      copyTexts={copyTexts}
      blurDataUrl={BLUR}
      featuredProjects={featuredProjects}
      reviewRating={review.rating}
      reviewCount={review.count}
    />
  );
}
