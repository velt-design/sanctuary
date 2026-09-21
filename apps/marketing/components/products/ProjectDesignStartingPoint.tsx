import { Button, Container, Eyebrow, Heading, Text } from '../marketing-foundation/Primitives';
import { designEntryHref, ST_HELIERS_START } from './productSelection';
import composition from '../marketing-foundation/editorial/composition.module.css';

export default function ProjectDesignStartingPoint() {
  const href = designEntryHref('configurator', ST_HELIERS_START, { sourcePath: '/projects/st-heliers-townhouse', sourceProject: 'st-heliers-townhouse', sourceComponent: 'project_cta' });
  return <section className={`${composition.section} ${composition.warm}`} aria-labelledby="project-start-title">
    <Container width="wide" className={composition.detailGrid}>
      <div><Eyebrow>Make it your starting point</Eyebrow><Heading id="project-start-title">A 6 × 3 m gable.<br />Adapted to your home.</Heading></div>
      <div><Text>Start with this project’s roof shape and footprint, then adjust the design for your own space.</Text>
        <Text size="small">The designer uses standard acrylic and a standard end frame. It does not reproduce this project’s opal tint, custom end-frame pattern or 2.7 m height. House attachment, ridge direction and height start from model defaults for you to discuss with us.</Text>
        <Button href={href} prefetch={false}>Start with this roof shape and size</Button>
      </div>
    </Container>
  </section>;
}
