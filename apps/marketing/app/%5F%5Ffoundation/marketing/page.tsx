import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/inter';
import {
  ActionGroup, Button, CardGrid, CheckboxField, ComparisonTable, Container, ConversionSection,
  EditorialCard, EditorialSplit, Eyebrow, FactList, FaqList, Field, Figure, FoundationNavigation,
  FullBleedStatement, Heading, ImageNarrative, IntroStatement, MarketingHero, MarketingPage,
  MaterialPalette, NavigationStates, NumberedPrinciples, ProcessSteps, ProjectMeta, ProjectStory,
  RadioGroup, ResponsiveExamples, Section, SectionHeader, SelectField, SpecificationRows,
  StaggeredGallery, TestimonialQuote, Text, TextareaField, TextLink,
} from '@/components/marketing-foundation';
import { WARKWORTH_EXTERIOR_IMAGE, WARKWORTH_EXTERIOR_OBJECT_POSITION } from '@/lib/projectImageFraming';
import styles from './catalogue.module.css';
import { shouldShowMarketingFoundation } from './foundationAccess';

export const metadata: Metadata = { title: 'Marketing UI Foundation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const foundationSteps = [
  ['Enquiry', 'Tell us about the site, how you use the space, and what you want the new outdoor room to achieve.'],
  ['Initial estimate', 'We prepare an early price range from your dimensions, photos, material direction, and roof form.'],
  ['Site visit and design', 'We measure the site and resolve proportion, structure, drainage, views, and connection to the home.'],
  ['Documentation and sign-off', 'A clear design pack records dimensions, finishes, lighting, and agreed construction scope.'],
  ['Manufacture', 'Your pergola is prepared for the site with the agreed structural and finish details.'],
  ['Installation', 'The Sanctuary team sets out and builds the structure to the signed-off design and agreed site sequence.'],
  ['Completion and support', 'We complete final checks and provide the care, workmanship, and manufacturer information that applies to the project.'],
].map(([title, copy]) => ({ title, copy }));

const materials = [
  { name: 'Aluminium', guidance: 'Crisp, durable structure with powder-coated colours selected to sit quietly alongside the home.', image: '/images/project-riverhead-gable-02.jpg', alt: 'Black aluminium pergola structure in Riverhead' },
  { name: 'Acrylic roofing', guidance: 'Clear or tinted cover that protects from weather while preserving useful daylight.', image: '/images/product-gable-01.jpg', alt: 'Acrylic-roof pergola over a commercial courtyard' },
  { name: 'Timber sarking', guidance: 'Warm, tactile lining that makes the pergola read as a permanent outdoor room.', image: '/images/timber-gable-ceiling.jpg', alt: 'Timber sarking beneath a gable pergola' },
  { name: 'Accessories', guidance: 'Lighting, blinds, heating, and infill are integrated when they support how the space will be used.', image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'Integrated lighting in a finished outdoor room' },
];

export default function MarketingFoundationPage() {
  if (!shouldShowMarketingFoundation({ nodeEnv: process.env.NODE_ENV, enabled: process.env.ENABLE_MARKETING_FOUNDATION })) notFound();

  return <MarketingPage className={styles.page} id="foundation" data-marketing-foundation>
    <FoundationNavigation />
    <div className={styles.masthead}><Container width="wide"><div className={styles.mastheadGrid}><div><Eyebrow>Sanctuary Pergolas</Eyebrow><Heading as="h1" variant="display">Architectural Editorial UI Foundation</Heading></div><Text size="large" className={styles.summary}>A restrained, image-led system for presenting permanent outdoor architecture with clarity and technical credibility.</Text></div></Container></div>

    <Section tone="elevated" id="patterns"><Container width="wide"><div className={styles.sectionHead}><Heading>Navigation states</Heading><Text>The internal navigation is keyboard operable; these specimens define its solid, image-overlay, and collapsed marketing states.</Text></div><NavigationStates /></Container></Section>
    <MarketingHero kind="homepage" />
    <Section tone="warm"><Container width="wide"><div className={styles.sectionHead}><Heading>Project hero</Heading><Text>A project-first variation leads with photography, title, location, project type, roof form, and year.</Text></div></Container><MarketingHero kind="project" /></Section>

    <Section tone="warm"><Container width="wide"><div className={styles.sectionHead}><Heading>Colour and surface</Heading><Text>Quiet neutrals support the photography. Olive green is the single accent for primary actions, conversion moments, and visible focus.</Text></div><div className={styles.swatches}>{[['Canvas',styles.canvas],['Warm surface',styles.warm],['Neutral surface',styles.neutral],['Elevated surface',styles.elevated],['Olive action',styles.olive],['Olive hover',styles.oliveHover],['Inverse',styles.inverse],['Rules',styles.rule]].map(([label, className]) => <div key={label} className={`${styles.swatch} ${className}`}>{label}</div>)}</div></Container></Section>

    <Section><Container><div className={styles.typeSpecimen}><Eyebrow>Typography</Eyebrow><Heading variant="page">Designed as part of the home.</Heading><Heading>Calm, precise, and resolved in detail.</Heading><Text size="large">Instrument Sans gives architectural statements a clear editorial voice. Inter keeps explanations, specifications, and controls highly legible.</Text><ProjectMeta items={['Warkworth', 'Residential', 'Gable', '2025']} /></div></Container></Section>

    <Section tone="neutral"><Container width="wide"><Eyebrow>12-column grid</Eyebrow><div className={styles.gridDemo}>{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div></Container></Section>
    <Section tone="elevated"><Container><div className={styles.sectionHead}><Heading>Spacing scale</Heading><Text>Section rhythm is generous; component spacing follows a restrained 8px-based scale.</Text></div><div className={styles.spaceScale}>{[['08',8],['16',16],['24',24],['40',40],['64',64]].map(([label, width]) => <div className={styles.spaceRow} key={label}><code>{label}px</code><span style={{ width: `${Number(width) * 3}px` }} /></div>)}</div></Container></Section>
    <Section><Container width="wide"><div className={styles.sectionHead}><Heading>Responsive composition</Heading><Text>Wide editorial pairings become simpler stacked compositions at tablet and mobile widths while type, spacing, and touch targets compress deliberately.</Text></div><ResponsiveExamples /></Container></Section>
    <Section tone="warm" id="mobile-primitives" data-foundation-primitives>
      <Container width="wide" className={styles.primitiveStack}>
        <SectionHeader
          eyebrow="Shared mobile primitives"
          heading="One responsive contract, three deliberate card densities."
          headingId="mobile-primitives-title"
        >
          <Text>Section rhythm, readable measures, action hierarchy, project facts, and media framing remain consistent without separate mobile markup.</Text>
        </SectionHeader>
        <ActionGroup aria-label="Shared action hierarchy">
          <Button href="/contact">Primary action</Button>
          <Button href="/projects" variant="secondary">Secondary action</Button>
          <TextLink href="/pergola-guides">Supporting text link</TextLink>
        </ActionGroup>
        <CardGrid columns={3}>
          <EditorialCard
            href="/projects/warkworth-outdoor-room"
            variant="image-led"
            eyebrow="Project"
            title="Warkworth Outdoor Room"
            copy="A generous image-first story for work where the built result should lead."
            actionLabel="View project"
            media={{
              image: WARKWORTH_EXTERIOR_IMAGE,
              alt: 'Warkworth outdoor room integrated with the home',
              ratio: 'landscape',
              mobileRatio: 'standard',
              objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION,
            }}
          />
          <EditorialCard
            href="/pergolas"
            variant="balanced"
            eyebrow="Service"
            title="Residential pergolas"
            copy="Equal weight for the image, proposition, and next step."
            actionLabel="Explore pergolas"
            media={{
              image: '/images/project-riverhead-gable-01.jpg',
              alt: 'Riverhead poolside gable pavilion',
              ratio: 'landscape',
              mobileRatio: 'standard',
            }}
          />
          <EditorialCard
            href="/products/pergolas/gable"
            variant="compact"
            eyebrow="Roof form"
            title="Gable"
            copy="A concise choice card for denser supporting collections."
            actionLabel="View gable pergolas"
            media={{
              image: '/images/product-gable-01.jpg',
              alt: 'Gable pergola over an outdoor courtyard',
              ratio: 'square',
              mobileRatio: 'square',
            }}
          />
        </CardGrid>
        <div className={styles.primitivePair}>
          <FactList
            aria-label="Project fact list example"
            items={[
              { label: 'Footprint', value: '5.55 × 4.20 m' },
              { label: 'Configuration', value: 'Freestanding' },
              { label: 'Roof form', value: 'Timber-lined gable' },
            ]}
          />
          <Figure
            image="/images/project-riverhead-gable-03.png"
            alt="Timber sarking and integrated lighting detail"
            ratio="landscape"
            mobileRatio="standard"
            objectPosition="50% 50%"
            mobileObjectPosition="42% 50%"
            caption="Responsive media"
            detail="16:10 desktop / 4:3 mobile"
          />
        </div>
      </Container>
    </Section>

    <Section><IntroStatement eyebrow="Introduction" heading="Outdoor rooms, tailored to their setting." copy="Every Sanctuary pergola begins with the architecture, climate, and daily life around it. The system uses proportion, honest materials, and project photography to make that approach visible." /></Section>
    <Section tone="warm"><EditorialSplit eyebrow="Editorial split" heading="A permanent addition, not an off-the-shelf cover." copy="Structure, roof form, light, drainage, and finish are resolved together so the pergola feels connected to the original home." image={WARKWORTH_EXTERIOR_IMAGE} alt="Warkworth outdoor room integrated with the home" objectPosition={WARKWORTH_EXTERIOR_OBJECT_POSITION} action={{ label: 'View projects', href: '/projects' }} /></Section>
    <Section><Container><Eyebrow>Principles</Eyebrow><NumberedPrinciples items={[{title:'Start with the home',copy:'Rooflines, openings, views, and circulation set the design direction.'},{title:'Resolve the details',copy:'Fixings, falls, drainage, lighting, and transitions are considered early.'},{title:'Build for New Zealand',copy:'Materials and structure are selected for local wind, rain, sun, and coastal exposure.'}]} /></Container></Section>
    <Section tone="warm"><Container width="wide"><ImageNarrative image="/images/project-riverhead-gable-01.jpg" alt="Riverhead poolside gable pavilion" eyebrow="Image narrative" heading="A clear span frames the landscape."><Text>The Riverhead pavilion creates shelter beside the pool while keeping the outlook open through the gable end.</Text><TextLink href="/projects/riverhead-gable-pavilion">Read the project story</TextLink></ImageNarrative></Container></Section>
    <FullBleedStatement image="/images/riverhead-gable-01.jpg" alt="Timber-lined gable pergola overlooking a pool and green landscape" eyebrow="Year-round outdoor living" heading="Shelter without losing the view." copy="Permanent construction, warm materials, and integrated light extend the home outdoors." action={{ label: 'Start your project', href: '/contact' }} />
    <Section><Container width="wide"><Eyebrow>Staggered gallery</Eyebrow><StaggeredGallery items={[{image:WARKWORTH_EXTERIOR_IMAGE,alt:'Warkworth outdoor room',title:'Warkworth Outdoor Room',detail:'Residential · Gable',href:'/projects/warkworth-outdoor-room',objectPosition:WARKWORTH_EXTERIOR_OBJECT_POSITION},{image:'/images/project-dairy-flat-01.jpg',alt:'Dairy Flat gable pergola',title:'Dairy Flat Estate',detail:'Residential · Gable',href:'/projects/dairy-flat-estate'},{image:'/images/project-velskov-01.jpg',alt:'Pergola in Velskov forest',title:'Velskov Forest',detail:'Commercial · Pitched',href:'/projects/velskov-forest'}]} /></Container></Section>
    <Section tone="neutral"><Container><div className={styles.sectionHead}><Heading>Technical information</Heading><Text>Labels stay subtle. Values align cleanly and use tabular numerals.</Text></div><SpecificationRows rows={[{label:'Structure',value:'Powder-coated aluminium and engineered steel where required'},{label:'Roof form',value:'Gable with timber sarking'},{label:'Approximate footprint',value:'5.55 m × 4.20 m'},{label:'Warranty information',value:'Written terms supplied for the project and selected products'}]} /></Container></Section>
    <Section><Container width="wide"><div className={styles.sectionHead}><Heading>Material palette</Heading><Text>Materials are presented in context, with concise guidance rather than retail-style swatches.</Text></div><MaterialPalette items={materials} /></Container></Section>
    <Section tone="warm"><Container width="wide"><ProjectStory image={WARKWORTH_EXTERIOR_IMAGE} alt="Warkworth outdoor room" title="Warkworth Outdoor Room" metadata={['Warkworth','Residential','Gable','2025']} copy="A timber-lined gable roof turns the terrace into a sheltered extension of the home, with structure and services composed as one architectural element." href="/projects/warkworth-outdoor-room" objectPosition={WARKWORTH_EXTERIOR_OBJECT_POSITION} /></Container></Section>
    <Section tone="inverse"><Container><TestimonialQuote quote="It has extended our living space and created an awesome outdoor entertainment area." author="Stuart Jones" context="Google review" /></Container></Section>
    <Section><Container width="wide"><div className={styles.sectionHead}><Heading>Our process</Heading><Text>Seven clear stages move from an early conversation to permanent construction and support.</Text></div><ProcessSteps items={foundationSteps} /></Container></Section>
    <Section tone="neutral"><Container width="wide"><div className={styles.sectionHead}><Heading>Custom-designed versus standard systems</Heading><Text>Factual comparison, structured for scanning and deliberately stacked on mobile.</Text></div><ComparisonTable rows={[{criterion:'Design basis',sanctuary:'Resolved for the home, site, and intended use.',standard:'Selected from predetermined modules and spans.'},{criterion:'Roof and material options',sanctuary:'Roof form, acrylic, timber, and combinations composed together.',standard:'Options depend on the selected product system.'},{criterion:'Integration',sanctuary:'Drainage, lighting, screens, and junctions considered in the design.',standard:'Accessories are typically added within system limits.'},{criterion:'Installation',sanctuary:'Installed by the Sanctuary team to the signed-off design.',standard:'Varies by supplier and installer.'}]} /></Container></Section>
    <Section><Container><div className={styles.sectionHead}><Heading>Frequently asked questions</Heading><Text>Native disclosure controls retain keyboard and assistive-technology support.</Text></div><FaqList items={[{question:'How early can I get an estimate?',answer:'Share photos and rough dimensions with the team and we can prepare an initial estimate before a measured site visit.'},{question:'Can timber and acrylic be combined?',answer:'Yes. Combination roofs can balance daylight, shade, warmth, and acoustic comfort across different parts of the pergola.'},{question:'How long does installation take?',answer:'The current programme and on-site sequence are confirmed in the project proposal after the site, scope, and supplier inputs are checked.'}]} /></Container></Section>

    <Section tone="warm"><Container><div className={styles.sectionHead}><Heading>Forms and interaction states</Heading><Text>Every field has a visible label, at least a 44px target, and clear focus, error, disabled, and helper states.</Text></div><form className={styles.forms}><div className={styles.progress} role="progressbar" aria-label="Enquiry progress" aria-valuemin={1} aria-valuemax={2} aria-valuenow={1}><span>Step 1 of 2 · Project details</span><span className={styles.progressTrack}><span className={styles.progressValue} /></span></div><Field id="foundation-name" label="Name" placeholder="Your name" autoComplete="name" /><Field id="foundation-email" label="Email" type="email" placeholder="name@example.com" error="Enter a valid email address." /><SelectField id="foundation-style" label="Preferred pergola style" defaultValue=""><option value="" disabled>Select an option</option><option>Gable</option><option>Pitched</option><option>Hip</option><option>Box perimeter</option></SelectField><Field id="foundation-disabled" label="Project reference" value="Added after enquiry" disabled readOnly /><TextareaField id="foundation-message" label="Tell us about the space" helper="Include rough dimensions, location, and how you want to use the area." className={styles.formsWide} /><Field id="foundation-upload" label="Site photos or plans" type="file" accept="image/*,.pdf" helper="JPG, PNG, or PDF. Up to 10 MB per file." className={styles.formsWide} /><RadioGroup legend="Project timing" name="foundation-timing" options={[{label:'As soon as practical',value:'soon'},{label:'Within 6–12 months',value:'year'},{label:'Exploring options',value:'exploring'}]} /><div><CheckboxField id="foundation-consent" label="I agree to be contacted about this enquiry." /><CheckboxField id="foundation-files" label="I have photos or plans to share." /></div><div className={`${styles.actionRow} ${styles.formsWide}`}><button type="button" className="marketing-foundation-submit">Send enquiry</button><button type="button" className="marketing-foundation-submit" disabled aria-busy="true">Sending enquiry…</button></div><div className={`${styles.stateNote} ${styles.formsWide}`} role="status"><strong>Thank you. We’ll be in touch shortly.</strong><br />Your project details have been received.</div></form></Container></Section>
    <Section><Container><div className={styles.componentStack}><Eyebrow>Actions</Eyebrow><div className={styles.actionRow}><Button href="/contact">Start your project</Button><Button href="/projects" variant="secondary">View projects</Button><Button href="/contact" variant="outline">Outline action</Button><Button href="/contact">Send enquiry</Button><TextLink href="/projects">Quiet text link</TextLink></div><Figure image="/images/project-riverhead-gable-03.png" alt="Timber sarking and integrated lighting detail" caption="Riverhead Gable Pavilion" detail="Timber sarking · Integrated lighting" /></div></Container></Section>
    <ConversionSection heading="Bring us the site. We’ll help resolve the possibilities." copy="Share a few photos, rough dimensions, and how you want the space to work." />
  </MarketingPage>;
}
