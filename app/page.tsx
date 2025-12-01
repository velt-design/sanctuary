import HomePageClient, {
  type HomePageContent,
} from '@/components/home/HomePageClient';
import './home.css';

// Simple neutral blur placeholder for LCP images
const BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAGElEQVQYV2NkYGD4z0AkYGBg+P8fA4YBAJ3pC3xwV0KpAAAAAElFTkSuQmCC';

const featureItems: HomePageContent['featureItems'] = [
  'On-site 1–5 days',
  'Lead time ~6 weeks',
  'Engineered for wind',
  'Aluminium, powder-coated',
  '10-year warranty',
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
];

// ~100-word copy for each process step (aligned by index)
const copyTexts: HomePageContent['copyTexts'] = [
  "Tell us how you use the space, share a few photos and rough sizes. We confirm feasibility, flag consent or engineering, and outline trade-offs in daylight, heat, headroom and upkeep before booking a visit.",
  "We price the best-fit style from your photos and dimensions, including structure, roofing and options. We explain cost drivers and alternatives. If the numbers work, we book a measured visit to refine scope.",
  "We measure carefully, consider sun, wind, eaves and access, test head heights and post locations, and review drainage. Samples show light. We sketch tweaks to balance function and appearance.",
  "We deliver a clear design pack with drawings, key dimensions, beam sizes, roof fall and finishes. Lighting and screens are integrated. Approval locks scope for fabrication and a smooth installation.",
  "Your deposit secures a production slot and materials. Lead time is typically four to six weeks. We coordinate trades, share a pre-start checklist, and confirm timing the week before.",
  "We protect surfaces, set out posts and beams, check fixings, and seal the house junction correctly. Wiring is concealed where possible. Most installs finish in one to five days.",
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
