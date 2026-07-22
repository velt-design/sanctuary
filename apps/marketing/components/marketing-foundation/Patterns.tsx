import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { WARKWORTH_EXTERIOR_IMAGE, WARKWORTH_EXTERIOR_OBJECT_POSITION } from '@/lib/projectImageFraming';
import { Button, Container, Eyebrow, Figure, Heading, ProjectMeta, Section, Text, TextLink, foundationStyles as styles } from './Primitives';

export function NavigationStates() {
  return (
    <div className={styles.navStateGrid} aria-label="Marketing navigation states">
      <article className={styles.navState}>
        <div className={styles.navStateBar}><span>Sanctuary</span><span className={styles.navStateLinks}>Projects&nbsp;&nbsp; Pergola Styles&nbsp;&nbsp; Materials&nbsp;&nbsp; Our Approach&nbsp;&nbsp; Contact</span><strong>Start your project</strong></div>
        <span className={styles.navStateLabel}>Solid / scrolled</span>
      </article>
      <article className={`${styles.navState} ${styles.navStateTransparent}`}>
        <div className={styles.navStateImage} style={{ backgroundPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION }} aria-hidden="true" />
        <div className={styles.navStateBar}><span>Sanctuary</span><span className={styles.navStateLinks}>Projects&nbsp;&nbsp; Pergola Styles&nbsp;&nbsp; Materials&nbsp;&nbsp; Our Approach&nbsp;&nbsp; Contact</span><strong>Start your project</strong></div>
        <span className={styles.navStateLabel}>Transparent / over hero</span>
      </article>
      <article className={`${styles.navState} ${styles.navStateMobile}`}>
        <div className={styles.navStateBar}><span>Sanctuary</span><span aria-label="Menu">&#9776;</span></div>
        <span className={styles.navStateLabel}>Mobile / collapsed</span>
      </article>
    </div>
  );
}

export function MarketingHero({ kind }: { kind: 'homepage' | 'project' }) {
  const isProject = kind === 'project';
  return (
    <section className={styles.heroPreview} aria-label={`${isProject ? 'Project' : 'Homepage'} hero pattern`}>
      <div className={styles.heroPreviewMedia}>
        <Figure
          image={isProject ? WARKWORTH_EXTERIOR_IMAGE : '/images/riverhead-gable-01.jpg'}
          alt={isProject ? 'Warkworth outdoor room connected to a weatherboard home' : 'Timber-lined Riverhead gable pergola beside a pool'}
          priority={!isProject}
          objectPosition={isProject ? WARKWORTH_EXTERIOR_OBJECT_POSITION : undefined}
        />
      </div>
      <Container width="wide" className={styles.heroPreviewContent}>
        {isProject ? <ProjectMeta items={['Warkworth', 'Residential', 'Gable', '2025']} /> : <Eyebrow>Architectural outdoor living</Eyebrow>}
        <Heading as="h2" variant="page">{isProject ? 'Warkworth Outdoor Room' : 'Architectural pergolas tailored to Kiwi homes.'}</Heading>
        <Text size="large">{isProject ? 'A timber-lined gable transforms the terrace into a sheltered extension of the home.' : 'Bespoke design and permanent construction for year-round outdoor living.'}</Text>
        {!isProject && <div className={styles.heroPreviewActions}><Button href="/contact">Start your project</Button><TextLink href="/projects">View projects</TextLink></div>}
      </Container>
    </section>
  );
}

export function ResponsiveExamples() {
  const frames = [
    { name: 'Desktop', size: '1440+', className: '' },
    { name: 'Tablet', size: '768', className: styles.responsiveTablet },
    { name: 'Mobile', size: '390', className: styles.responsiveMobile },
  ];
  return (
    <div className={styles.responsiveFrames}>
      {frames.map((frame) => (
        <article className={`${styles.responsiveFrame} ${frame.className}`} key={frame.name}>
          <div className={styles.responsiveFrameLabel}><span>{frame.name}</span><span>{frame.size}px</span></div>
          <div className={styles.responsiveFrameBody}>
            <div className={styles.responsiveFrameMedia} aria-hidden="true" />
            <div className={styles.responsiveFrameCopy} aria-hidden="true"><span /><span /><span /><span /></div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function IntroStatement({ eyebrow, heading, copy }: { eyebrow: string; heading: string; copy: string }) {
  return <Container><div className={styles.introGrid}><div><Eyebrow>{eyebrow}</Eyebrow><Heading>{heading}</Heading></div><Text size="large">{copy}</Text></div></Container>;
}

export function EditorialSplit({ eyebrow, heading, copy, image, alt, reverse = false, action, objectPosition }: { eyebrow: string; heading: string; copy: string; image: string; alt: string; reverse?: boolean; action?: { label: string; href: string }; objectPosition?: string }) {
  return <Container width="wide"><div className={cn(styles.split, reverse && styles.splitReverse)}><Figure image={image} alt={alt} className={styles.splitMedia} objectPosition={objectPosition} /><div className={styles.splitCopy}><Eyebrow>{eyebrow}</Eyebrow><Heading>{heading}</Heading><Text>{copy}</Text>{action && <TextLink href={action.href}>{action.label}</TextLink>}</div></div></Container>;
}

export function NumberedPrinciples({ items }: { items: Array<{ title: string; copy: string }> }) {
  return <div className={styles.principles}>{items.map((item, index) => <article className={styles.principle} key={item.title}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><Heading as="h3" variant="card">{item.title}</Heading><Text>{item.copy}</Text></article>)}</div>;
}

export function ImageNarrative({ image, alt, eyebrow, heading, children }: { image: string; alt: string; eyebrow: string; heading: string; children: ReactNode }) {
  return <div className={styles.narrative}><Figure image={image} alt={alt} /><div className={styles.narrativeCopy}><Eyebrow>{eyebrow}</Eyebrow><Heading>{heading}</Heading>{children}</div></div>;
}

export function FullBleedStatement({ image, alt, eyebrow, heading, copy, action, priority = false }: { image: string; alt: string; eyebrow: string; heading: string; copy: string; action?: { label: string; href: string }; priority?: boolean }) {
  return <section className={styles.fullBleed}><div className={styles.fullBleedImage}><Figure image={image} alt={alt} priority={priority} sizes="100vw" /></div><Container width="wide" className={styles.fullBleedContent}><Eyebrow>{eyebrow}</Eyebrow><Heading variant="page">{heading}</Heading><Text size="large">{copy}</Text>{action && <TextLink href={action.href}>{action.label}</TextLink>}</Container></section>;
}

export function StaggeredGallery({ items }: { items: Array<{ image: string; alt: string; title: string; detail?: string; href?: string; objectPosition?: string }> }) {
  return <div className={styles.gallery}>{items.map((item, index) => <article key={item.title}><Figure image={item.image} alt={item.alt} caption={item.title} detail={item.detail} ratio={index % 3 === 1 ? 'portrait' : 'landscape'} objectPosition={item.objectPosition} />{item.href && <TextLink href={item.href}>View project</TextLink>}</article>)}</div>;
}

export function SpecificationRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return <dl className={styles.specRows}>{rows.map((row) => <div className={styles.specRow} key={row.label}><dt className={styles.specLabel}>{row.label}</dt><dd className={styles.specValue}>{row.value}</dd></div>)}</dl>;
}

export function MaterialPalette({ items }: { items: Array<{ name: string; guidance: string; image: string; alt: string }> }) {
  return <div className={styles.materialGrid}>{items.map((item) => <article className={styles.material} key={item.name}><div className={styles.materialImage}><Figure image={item.image} alt={item.alt} ratio="standard" sizes="(max-width: 640px) 96px, (max-width: 900px) 112px, 176px" /></div><div className={styles.materialCopy}><Heading as="h3" variant="card">{item.name}</Heading><Text size="small">{item.guidance}</Text></div></article>)}</div>;
}

export function ProjectStory({ image, alt, title, metadata, copy, href, objectPosition }: { image: string; alt: string; title: string; metadata: string[]; copy: string; href: string; objectPosition?: string }) {
  return <article className={styles.projectStory}><Figure image={image} alt={alt} ratio="landscape" objectPosition={objectPosition} /><div className={styles.projectStoryCopy}><ProjectMeta items={metadata} /><Heading as="h3">{title}</Heading><Text>{copy}</Text><TextLink href={href}>View project</TextLink></div></article>;
}

export function TestimonialQuote({ quote, author, context }: { quote: string; author: string; context?: string }) {
  return <figure className={styles.quote}><blockquote>&ldquo;{quote}&rdquo;</blockquote><figcaption>{author}{context ? ` · ${context}` : ''}</figcaption></figure>;
}

export function ProcessSteps({ items }: { items: Array<{ title: string; copy: string }> }) {
  return <ol className={styles.process}>{items.map((item, index) => <li className={styles.processRow} key={item.title}><span className={styles.processNumber}>{String(index + 1).padStart(2, '0')}</span><Heading as="h3" variant="card">{item.title}</Heading><Text>{item.copy}</Text></li>)}</ol>;
}

export function ComparisonTable({ rows }: { rows: Array<{ criterion: string; sanctuary: string; standard: string }> }) {
  return <div className={styles.comparison} role="table" aria-label="Custom-designed versus standard systems"><div className={styles.comparisonHeader} role="row"><div role="columnheader">Consideration</div><div role="columnheader">Sanctuary custom pergola</div><div role="columnheader">Standard modular pergola</div></div>{rows.map((row) => <div className={styles.comparisonRow} role="row" key={row.criterion}><div className={styles.comparisonLabel} role="rowheader">{row.criterion}</div><div role="cell" data-label="Sanctuary custom pergola">{row.sanctuary}</div><div role="cell" data-label="Standard modular pergola">{row.standard}</div></div>)}</div>;
}

export function FaqList({ items }: { items: Array<{ question: string; answer: string }> }) {
  return <div className={styles.faq}>{items.map((item) => <details key={item.question}><summary>{item.question}</summary><Text className={styles.faqAnswer}>{item.answer}</Text></details>)}</div>;
}

export function ConversionSection({ eyebrow = 'Start a conversation', heading, copy, actionLabel = 'Start your project', href = '/contact' }: { eyebrow?: string; heading: string; copy: string; actionLabel?: string; href?: string }) {
  return <Section tone="inverse"><Container width="wide"><div className={styles.conversion}><div><Eyebrow>{eyebrow}</Eyebrow><Heading>{heading}</Heading><Text size="large">{copy}</Text></div><div className={styles.conversionActions}><Button href={href}>{actionLabel}</Button></div></div></Container></Section>;
}
