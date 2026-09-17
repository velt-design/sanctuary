'use client';

import { useState } from 'react';
import { Container, Eyebrow, Heading, MarketingPage, Text, TextLink } from '@/components/marketing-foundation';
import ProjectStudy from './ProjectStudy';
import MaterialStudy from './MaterialStudy';
import MenuStudy from './MenuStudy';
import styles from './evolution.module.css';

export default function Evolution() {
  const [mode, setMode] = useState<'quiet' | 'expressive'>('quiet');
  const [still, setStill] = useState(false);
  const [replay, setReplay] = useState(0);

  return <MarketingPage className={styles.page} data-motion={mode} data-still={still} id="studies">
    <a href="#study-content" className={styles.skip}>Skip to studies</a>
    <Container width="wide">
      <header className={styles.topline}>
        <a href="/__foundation/marketing" className={styles.brand} aria-label="Sanctuary foundation catalogue">Sanctuary<span>Pergolas</span></a>
        <span className={styles.edition}>Foundation studies / 01</span>
        <MenuStudy />
      </header>
      <div className={styles.intro}>
        <div><Eyebrow>Architectural editorial · proposed evolution</Eyebrow><Heading as="h1" variant="page">A quieter kind<br />of presence.</Heading></div>
        <div className={styles.introCopy}><Text size="large">Generous images. Clear choices.<br />Movement with a purpose.</Text><Text>Three working studies for the next Sanctuary foundation. Compare the motion, then explore the details.</Text><Text size="small">Internal design preview. Material choices are illustrative and are not saved to a customer project.</Text></div>
      </div>
      <div className={styles.referenceLinks}><TextLink href="/__foundation/marketing/evolution/project">Explore the complete project page</TextLink><Text>Next review stage: the foundation applied to a customer page.</Text></div>
    </Container>
    <div className={styles.toolbar}>
      <Container width="wide" className={styles.toolbarInner}>
        <fieldset className={styles.mode}><legend>Motion treatment</legend><div>{(['quiet', 'expressive'] as const).map(value => <label key={value}><input type="radio" name="motion" checked={mode === value} onChange={() => setMode(value)} /><span>{value === 'quiet' ? 'Quiet' : 'Expressive'}</span></label>)}</div></fieldset>
        <label className={styles.still}><input type="checkbox" checked={still} onChange={event => setStill(event.target.checked)} /> Reduce motion</label>
        <button className={styles.control} onClick={() => { document.getElementById('project-image-study')?.scrollIntoView({ block: 'start', behavior: 'instant' }); setReplay(value => value + 1); }}>Replay image arrival <span aria-hidden="true">↗</span></button>
        <p className={styles.motionNote} aria-live="polite">{still ? 'Motion removed. Feedback stays.' : mode === 'quiet' ? 'Quiet · smaller movement, brisk response.' : 'Expressive · more travel, softer settling.'}<span> Your device’s reduced-motion setting always takes priority.</span></p>
      </Container>
    </div>
    <div id="study-content">
      <noscript><Container><Text>Interactive comparisons need JavaScript. You can still read the studies, follow the project link and open the material details below.</Text></Container></noscript>
      <ProjectStudy replay={replay} />
      <MaterialStudy />
      <section className={styles.section} id="navigation-study"><Container width="wide">
        <div className={styles.sectionHeading}><Eyebrow>03 / Navigate</Eyebrow><Heading>A clear way through.</Heading><Text>The menu groups the three studies in one opaque panel. Try opening it, choosing a destination, and reopening it. Escape closes it and returns you to the control.</Text></div>
        <div className={styles.navigationExample}><div><span className={styles.micro}>Navigation specimen</span><p className={styles.navigationTitle}>Sanctuary Pergolas</p></div><MenuStudy /></div>
        <div className={styles.familyGrid}>{[
          ['01', 'Respond', 'Small changes acknowledge a press or selection. Cards keep their geometry.'],
          ['02', 'Reveal', 'Panels enter together. Labels and controls remain easy to follow.'],
          ['03', 'Transition', 'Related information changes in place, keeping the surrounding page steady.'],
          ['04', 'Arrive', 'An image settles once. Reading and navigation never wait for an animation.'],
        ].map(([number, title, copy]) => <div key={title}><span className={styles.micro}>{number}</span><h3>{title}</h3><Text>{copy}</Text></div>)}</div>
      </Container></section>
    </div>
    <Container width="wide" className={styles.endnote}><Text>Proposed foundation · local comparison · no public rollout</Text><TextLink href="/__foundation/marketing">Existing catalogue</TextLink></Container>
  </MarketingPage>;
}
