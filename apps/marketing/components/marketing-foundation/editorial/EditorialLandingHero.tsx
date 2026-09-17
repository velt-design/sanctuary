import type { ReactNode } from 'react';
import { Container, Eyebrow, Figure, Heading, Text } from '../Primitives';
import styles from './composition.module.css';
import hero from './product-composition.module.css';
export default function EditorialLandingHero({id,eyebrow,title,intro,image,alt,objectPosition,caption,children,media}: {
 id:string;eyebrow:string;title:string;intro:string;image:string;alt:string;objectPosition?:string;caption?:string;children:ReactNode;media?:ReactNode;
}) {
 return <Container width="wide"><section className={hero.hero} aria-labelledby={id} data-editorial-landing-hero>
  <div className={hero.heroCopy}><Eyebrow>{eyebrow}</Eyebrow><Heading as="h1" variant="display" id={id}>{title}</Heading><Text size="large" className={styles.lead}>{intro}</Text>{children}</div>
  {media ?? <Figure image={image} alt={alt} objectPosition={objectPosition} ratio="portrait" mobileRatio="standard" priority caption={caption} sizes="(max-width:760px) 100vw,60vw" />}
 </section></Container>;
}
