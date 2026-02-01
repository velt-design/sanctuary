import HomePageClient, {
  type HomePageContent,
} from '@/components/home/HomePageClient';
import './home.css';
import './projects/projects.css';

// Simple neutral blur placeholder for LCP images
const BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAGElEQVQYV2NkYGD4z0AkYGBg+P8fA4YBAJ3pC3xwV0KpAAAAAElFTkSuQmCC';

const featureItems: HomePageContent['featureItems'] = [
  {
    label: 'Install in days',
    bubble: 'On-site installation is typically completed in 1–5 days.',
  },
  {
    label: 'Lead time 6–8 weeks',
    bubble: 'From sign-off to installation: typically 6–8 weeks. Timing can vary by season.',
  },
  {
    label: 'Engineered for wind',
    bubble: 'Designed with wind performance considered from the start, for NZ conditions.',
  },
  {
    label: '4 roof styles',
    bubble: 'Choose pitched, gable, hip, or box-perimeter to suit your home’s roofline.',
  },
  {
    label: '10-year warranty',
    bubble: 'Backed by a 10-year warranty, with support after completion.',
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
    desc: 'Pay the deposit to secure your spot; typical lead time is 6–8 weeks.',
  },
  {
    title: 'On-site build',
    desc: 'We install your pergola on site, typically within 2–5 days.',
  },
  {
    title: 'Completion',
    desc: 'We run through care, warranty details and final checks with you.',
  },
];

// ~100-word copy for each process step (aligned by index)
const copyTexts: HomePageContent['copyTexts'] = [
  "Tell us how you use the space, share a few photos and rough sizes. We confirm feasibility and flag any consent or engineering requirements before booking a visit.",
  "We price the best-fit style from your photos and dimensions, including structure, roofing and options. We explain cost drivers and alternatives. If the numbers work, we book a measured visit to refine scope.",
  "We visit your site, measure carefully and talk through how you want to use the space. We look at the size and layout, the style of your home and key views from inside and out. We then work through roof options—including timber, acrylic or a combination—to suit your goals for the space and the look of the pergola.",
  "We deliver a clear design pack with drawings, key dimensions, beam sizes, roof fall and finishes. Lighting and screens are integrated. Approval locks scope for fabrication and a smooth installation.",
  "Your deposit secures a production slot and materials. Lead time is typically six to eight weeks. We prepare materials and confirm a firm start date two weeks before we're on site.",
  "We protect surfaces, set out posts and beams, check fixings, and seal the house junction correctly. Wiring is concealed where possible. Most installs finish in two to five days.",
  "We advise on cleaning and maintenance so the structure and roofing keep performing well, and we send through your warranty certificate for your records. Before we leave, we make sure you're happy with the result and know how to get in touch if anything needs attention.",
];

export default function HomePage() {
  return (
    <HomePageClient
      featureItems={featureItems}
      processSteps={processSteps}
      copyTexts={copyTexts}
      blurDataUrl={BLUR}
    />
  );
}
