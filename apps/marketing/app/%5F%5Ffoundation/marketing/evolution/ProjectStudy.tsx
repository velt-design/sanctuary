'use client';

import { useEffect, useRef, useState } from 'react';
import { Container, EditorialCard, Eyebrow, FactList, Heading, ResponsiveGallery, Text } from '@/components/marketing-foundation';
import { WARKWORTH_EXTERIOR_IMAGE, WARKWORTH_EXTERIOR_OBJECT_POSITION } from '@/lib/projectImageFraming';
import styles from './evolution.module.css';

export default function ProjectStudy({ replay }: { replay: number }) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const target = imageRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setArrived(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return <section className={styles.section} id="project-study"><Container width="wide">
    <div className={styles.sectionHeading}><Eyebrow>01 / Explore</Eyebrow><Heading>Let the work speak.</Heading><Text>A generous image, one useful detail, and a clear invitation to look closer. Select the card to explore the gallery below.</Text></div>
    <div className={styles.projectGrid} id="project-image-study" ref={imageRef}>
      <div key={replay} className={arrived ? styles.arrival : undefined}><EditorialCard className={styles.projectCard} href="#project-detail" variant="image-led" eyebrow="Warkworth, Auckland" title="Warkworth Outdoor Room" copy="An outdoor room connected to the home, with a warm timber ceiling and space to gather." actionLabel="Explore the project" media={{ image: WARKWORTH_EXTERIOR_IMAGE, alt: 'Gabled Warkworth outdoor room connected to the home', objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION, ratio: 'landscape', mobileRatio: 'standard', priority: true }} /></div>
      <aside className={styles.projectAside}><span className={styles.micro}>The composition</span><Heading as="h3" variant="card">Space for the image.<br />Precision in the details.</Heading><Text>Fine rules organise the page. A quiet surface change and moving arrow acknowledge interaction without lifting or shrinking the architecture.</Text><div className={styles.specLine}><span>Instrument Sans</span><span>Display</span></div><div className={styles.specLine}><span>Inter</span><span>Reading & controls</span></div><div className={styles.palette} aria-label="Warm neutral, charcoal and olive palette"><span /><span /><span /></div><Text size="small">Use the motion selector above, then hover or focus the card. On a phone, the same card responds to touch.</Text></aside>
    </div>
    <div className={styles.projectDetail} id="project-detail" tabIndex={-1}>
      <div><Eyebrow>Closer look / Warkworth</Eyebrow><Heading as="h3" variant="card">A room beyond the walls.</Heading><Text>Explore the exterior and the sheltered space beneath the roof.</Text><FactList items={[{ label: 'Location', value: 'Warkworth, Auckland' }, { label: 'Project', value: 'Outdoor room' }]} /><a className={styles.backLink} href="#project-study">↑ Back to project card</a></div>
      <ResponsiveGallery label="Warkworth project study" swipe items={[
        { id: 'exterior', image: WARKWORTH_EXTERIOR_IMAGE, alt: 'Exterior of the Warkworth outdoor room', caption: 'Connected to the home', detail: 'Exterior', objectPosition: WARKWORTH_EXTERIOR_OBJECT_POSITION, ratio: 'landscape' },
        { id: 'interior', image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'Timber ceiling and seating beneath the Warkworth pergola', caption: 'A sheltered place to gather', detail: 'Interior', ratio: 'landscape' },
      ]} />
    </div>
  </Container></section>;
}
