import { projectImageCaptions } from '@/data/projectImageCaptions';
import { EditorialFacts, MeasurementGroups } from '@/components/marketing-foundation/editorial/EditorialFacts';
import Link from 'next/link';
import { Button, Container, Disclosure, Eyebrow, Figure, Heading, ResponsiveGallery, Text, TextLink } from '@/components/marketing-foundation';
import type { Project } from '@/data/projects';
import { getProjectFacts, getProjectTechnicalSections } from '@/app/projects/projectPresentation';
import { PRODUCT_REFERENCE } from './referencePaths';
import ReferenceLink from './ReferenceLink';
import styles from './reference.module.css';

export default function ProjectReference({ project, enquiryHref }: { project: Project; enquiryHref: string }) {
  const interior = project.gallery[0];
  const detail = project.gallery[2];
  return <>
    <Container width="wide"><section className={styles.projectHero} aria-labelledby="project-title">
      <div className={styles.heroTitle}><Eyebrow>Built work / {project.location}</Eyebrow><Heading as="h1" variant="display" id="project-title">{project.title}</Heading></div>
      <div className={styles.heroIntro}><p className={styles.introText}>{project.blurb}</p><Link className={styles.jump} href="#project-story">Discover the project <span aria-hidden="true">↓</span></Link></div>
      <div className={styles.heroImage}><Figure image={interior.src} alt={interior.alt} objectPosition={interior.objectPosition} ratio="wide" mobileRatio="standard" priority sizes="(max-width: 1440px) 100vw, 1440px" caption="Warkworth Outdoor Room" detail={`${project.configuration} · ${project.year}`} /></div>
    </section><div className={styles.factsRail}><EditorialFacts variant="summary" items={[{ label: 'Location', value: project.location }, { label: 'Form', value: `${project.configuration} ${project.roof.toLowerCase()}` }, { label: 'Footprint', value: `${project.stats.width} × ${project.stats.depth}` }, { label: 'Completed', value: project.year }]} /></div></Container>

    <section id="project-story" className={styles.section}><Container width="wide" className={styles.storyGrid}>
      <div><Eyebrow>01 / The brief</Eyebrow><Heading>A room beside <br />the house.</Heading></div>
      <div className={styles.storyCopy}><p className={styles.lead}>{project.constraint}</p><Text>{project.description[1]}</Text><Text>{project.description[2]}</Text></div>
    </Container></section>

    <Container width="wide"><div className={styles.imagePair}>
      <Figure image={project.heroImage.src} alt={project.heroImage.alt} objectPosition={project.heroImage.objectPosition} ratio="portrait" caption="01 — A freestanding form" detail="Independent of the house structure" />
      <div className={styles.detailImage}><Figure image={detail.src} alt={detail.alt} objectPosition={detail.objectPosition} ratio="standard" caption="02 — Cedar and daylight" detail="Clear acrylic glazing and timber lining" /><Text>Solid roofing and clear acrylic zones bring shelter and daylight into the same room.</Text></div>
    </div></Container>

    <section className={`${styles.section} ${styles.warm}`} id="project-details"><Container width="wide" className={styles.detailGrid}>
      <div><Eyebrow>02 / In detail</Eyebrow><Heading>How it <br />comes together.</Heading><Text>Dimensions, finishes and details from this completed project.</Text><TextLink href={enquiryHref}>Discuss a similar project</TextLink></div>
      <div><EditorialFacts items={getProjectFacts(project).filter(fact => !['Project type', 'Region', 'Completed'].includes(fact.label)).map(fact => fact.label === 'Dimensions' ? { ...fact, value: <MeasurementGroups value={fact.value} /> } : fact)} />
        <div className={styles.disclosures}>{getProjectTechnicalSections(project).map(section => <Disclosure key={section.title} summary={section.title} bodyClassName={styles.disclosureBody}>{section.paragraphs.map(paragraph => <Text key={paragraph}>{paragraph}</Text>)}{section.bullets && <ul className={styles.detailList}>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}</Disclosure>)}</div>
      </div>
    </Container></section>

    <section className={styles.section} id="project-gallery"><Container width="wide"><div className={styles.sectionTop}><div><Eyebrow>03 / Around the room</Eyebrow><Heading>Look a little closer.</Heading></div><Text>The frame, roof and living space, seen from every side.</Text></div>
      <ResponsiveGallery label="Warkworth outdoor room" swipe items={project.gallery.map((image, index) => ({ id: image.src, image: image.src, alt: image.alt, objectPosition: image.objectPosition, ratio: 'wide', mobileRatio: 'standard', caption: projectImageCaptions[image.src] ?? image.alt, detail: `${String(index + 1).padStart(2, '0')} / ${String(project.gallery.length).padStart(2, '0')}`, sizes: '(max-width: 1440px) 100vw, 1440px' }))} />
    </Container></section>

    <section className={styles.productBridge}><Container width="wide" className={styles.bridgeGrid}><div><Eyebrow>The form behind the project</Eyebrow><Heading>Why a gable?</Heading><Text>A central ridge brings height and a clear centre to the outdoor room. Explore how roof materials, proportions and end treatments shape the result.</Text><ReferenceLink href={PRODUCT_REFERENCE}>Explore gable pergolas</ReferenceLink></div><Figure image={project.heroImage.src} alt={project.heroImage.alt} objectPosition={project.heroImage.objectPosition} ratio="landscape" /></Container></section>
    <section className={styles.conversion}><Container width="wide" className={styles.conversionGrid}><div><Eyebrow>Your place, your project</Eyebrow><Heading>An outdoor room<br />of your own.</Heading></div><div><Text size="large">Tell us about your home, the space and what you want it to become.</Text><Button href={enquiryHref}>Send your project brief <span aria-hidden="true">↗</span></Button><Text size="small">Start with your location, a few photos and any dimensions you have.</Text></div></Container></section>
  </>;
}
