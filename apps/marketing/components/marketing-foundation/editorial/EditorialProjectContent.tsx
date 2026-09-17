import type { ReactNode } from 'react';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import type { Project } from '@/data/projects';
import { projectImageCaptions } from '@/data/projectImageCaptions';
import { Button, Container, Disclosure, Eyebrow, Figure, Heading, ResponsiveGallery, Text, TextLink } from '../index';
import { EditorialFacts, MeasurementGroups } from './EditorialFacts';
import { getProjectFacts, getProjectFormLabel, getProjectTechnicalSections } from '@/app/projects/projectPresentation';
import ProjectGallery from '@/app/projects/ProjectGallery';
import styles from './composition.module.css';
import opening from '@/app/projects/projectOpening.module.css';

type Props = { nextProjectNavigation?: ReactNode; project: Project; enquiryHref: string; relatedProjects: Project[]; projectHref: (slug: string) => string };
export default function EditorialProjectContent({ nextProjectNavigation, project, enquiryHref, relatedProjects, projectHref }: Props) {
  const warkworth = project.slug === 'warkworth-outdoor-room';
  const hero = warkworth ? project.gallery[0] : project.caseStudyHeroImage ?? project.heroImage;
  const detail = project.gallery.find(image => image.src !== hero.src && image.src !== project.heroImage.src);
  return <article className="project-case-study" data-project-case-study={project.slug} aria-labelledby="project-case-study-title">
    <Container width="wide"><section className={`${styles.projectHero} ${opening.hero} project-case-study__intro`}>
      <div className={styles.heroTitle}><Eyebrow>Built work / {project.location}</Eyebrow><Heading as="h1" variant="display" id="project-case-study-title">{project.title}</Heading></div>
      <div className={`${styles.heroImage} project-case-study__hero`}><Figure image={hero.src} alt={hero.alt} objectPosition={hero.objectPosition} ratio="wide" mobileRatio="standard" priority sizes="(max-width:1440px) 100vw,1440px" caption={project.title} detail={[project.configuration ?? project.type, project.year].filter(Boolean).join(' · ')} /></div>
      <div className={styles.heroIntro}><p className={styles.introText}>{project.blurb}</p><a className={styles.jump} href="#project-story">Discover the project <span aria-hidden="true">↓</span></a></div>
    </section><div className={styles.factsRail}><EditorialFacts variant="summary" items={[
      { label:'Location',value:project.location }, { label:'Form',value:[project.configuration,getProjectFormLabel(project)].filter(Boolean).join(' ') },
      ...(project.stats.width && project.stats.depth ? [{ label:'Footprint',value:<MeasurementGroups value={project.stats.width+' × '+project.stats.depth} /> }] : []),
      ...(project.year ? [{label:'Completed',value:project.year}] : []),
    ]} /></div></Container>
    <section id="project-story" className={styles.section}><Container width="wide" className={styles.storyGrid}>
      <div><Eyebrow>01 / The brief</Eyebrow><Heading>{warkworth ? <>A room beside<br />the house.</> : 'Designed for this place.'}</Heading></div>
      <div className={styles.storyCopy}><p className={styles.lead}>{project.constraint}</p>{project.description.slice(warkworth ? 1 : 0).map(text => <Text key={text}>{text}</Text>)}</div>
    </Container></section>
    {detail && <Container width="wide"><div className={styles.imagePair}>
      <Figure image={project.heroImage.src} alt={project.heroImage.alt} objectPosition={project.heroImage.objectPosition} ratio="portrait" caption={warkworth ? '01 — A freestanding form' : '01 — The setting'} detail={warkworth ? 'Independent of the house structure' : project.location} />
      <div className={styles.detailImage}><Figure image={warkworth ? project.gallery[2].src : detail.src} alt={warkworth ? project.gallery[2].alt : detail.alt} objectPosition={warkworth ? project.gallery[2].objectPosition : detail.objectPosition} ratio="standard" caption={warkworth ? '02 — Cedar and daylight' : '02 — In detail'} /><Text>{warkworth ? 'Solid roofing and clear acrylic zones bring shelter and daylight into the same room.' : project.roofApproach}</Text></div>
    </div></Container>}
    <section className={`${styles.section} ${styles.warm}`} id="project-details"><Container width="wide" className={styles.detailGrid}>
      <div><Eyebrow>02 / In detail</Eyebrow><Heading>How it<br />comes together.</Heading><Text>Dimensions, finishes and details from this completed project.</Text><TextLink href={enquiryHref}>Discuss a similar project</TextLink></div>
      <div><EditorialFacts className="project-case-study__fact-list" items={getProjectFacts(project).filter(fact => !['Project type','Region','Completed'].includes(fact.label)).map(fact => fact.label === 'Dimensions' ? {...fact,value:<MeasurementGroups value={fact.value}/>} : fact)} />
        <div className={styles.disclosures}>{getProjectTechnicalSections(project).map(section => <Disclosure key={section.title} summary={section.title} bodyClassName={styles.disclosureBody}>{section.paragraphs.map(text => <Text key={text}>{text}</Text>)}{section.bullets && <ul className={styles.detailList}>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}</Disclosure>)}</div>
      </div>
    </Container></section>
    <section className={styles.section} id="project-gallery"><Container width="wide"><div className={styles.sectionTop}><div><Eyebrow>03 / Around the space</Eyebrow><Heading>Look a little closer.</Heading></div><Text>The frame, roof and living space, seen from every side.</Text></div><ResponsiveGallery key={project.slug} label={project.title + ' project gallery'} swipe items={project.gallery.map((image,index) => ({id:image.src,image:image.src,alt:image.alt,objectPosition:image.objectPosition,ratio:'wide',mobileRatio:'standard',caption:projectImageCaptions[image.src] ?? image.alt,detail:String(index+1).padStart(2,'0')+' / '+String(project.gallery.length).padStart(2,'0'),sizes:'(max-width:1440px) 100vw,1440px'}))} /></Container></section>
    {project.videoYoutubeId && <Container width="wide"><div className="project-case-study__video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${project.videoYoutubeId}?rel=0`} title={`${project.title} project video`} loading="lazy" allowFullScreen /></div></Container>}
    {warkworth && <section className={styles.productBridge}><Container width="wide" className={styles.bridgeGrid}><div><Eyebrow>The form behind the project</Eyebrow><Heading>Why a gable?</Heading><Text>A central ridge brings height and a clear centre to the outdoor room. Explore how roof materials, proportions and end treatments shape the result.</Text><TextLink href="/products/pergolas/gable">Explore gable pergolas</TextLink></div><Figure image={project.heroImage.src} alt={project.heroImage.alt} objectPosition={project.heroImage.objectPosition} ratio="landscape" /></Container></section>}
    {relatedProjects.length > 0 && <section className={styles.section} data-related-projects><Container width="wide"><Eyebrow>More built work</Eyebrow><div className={styles.sectionTop}><Heading>Related projects.</Heading>{relatedProjects.map(related => <TextLink key={related.slug} href={projectHref(related.slug)}>{related.title}</TextLink>)}</div></Container></section>}
    <section className={styles.conversion}><Container width="wide" className={styles.conversionGrid}><div><Eyebrow>Your place, your project</Eyebrow><Heading>{warkworth ? <>An outdoor room<br />of your own.</> : 'A space of your own.'}</Heading></div><div><Text size="large">Tell us about your space and what you want it to become.</Text><Button href={enquiryHref}>Send project brief <span aria-hidden="true"><ArrowUpRight /></span></Button><Text size="small">Start with your location, a few photos and any dimensions you have.</Text></div></Container></section>
    {nextProjectNavigation}
  </article>;
}
