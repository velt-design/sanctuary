"use client";

import {
  Container,
  Eyebrow,
  Heading,
  Section,
  Text,
} from '@/components/marketing-foundation/Primitives';
import { useConsent } from '@/components/ConsentProvider';
import styles from './privacy.module.css';

export default function PrivacyPage(){
  const { openBanner } = useConsent();

  return (
    <main className={styles.page} data-marketing-foundation-page>
      <Section>
        <Container width="reading">
          <header className={styles.header}>
            <Eyebrow>Privacy</Eyebrow>
            <Heading as="h1" variant="page">Privacy policy</Heading>
            <Text size="large">How we collect, use and protect your information.</Text>
          </header>

          <div className={styles.content}>
            <section>
              <Heading as="h2" variant="card">Summary</Heading>
              <Text>We collect only the information needed to respond to your enquiry and improve our website. We do not sell your data.</Text>
            </section>

            <section>
              <Heading as="h2" variant="card">What we collect</Heading>
              <ul>
                <li>Contact details you submit, such as your name, email, suburb and project notes.</li>
                <li>Optional project details, including sizes, style preferences, roofing and add-ons.</li>
                <li>Usage, performance and campaign-attribution data under the regional tracking settings below.</li>
                <li>Project files you choose to upload, such as photos, plans or sketches.</li>
              </ul>
            </section>

            <section>
              <Heading as="h2" variant="card">Cookies and analytics</Heading>
              <Text>We use essential, analytics and marketing cookie categories. Essential cookies keep core functions working. Analytics helps us understand site use. Marketing supports campaign measurement and advertising attribution.</Text>
              <Text>For visitors identified as being in New Zealand, analytics and marketing tracking are enabled by default without an initial banner. Visitors outside New Zealand, or when country cannot be determined, choose before optional tracking loads. A saved choice always takes priority.</Text>
              <Text>We use only the IP-derived country code to select this experience, keep the coarse result for the browser session, and do not store precise location for this purpose.</Text>
              <button type="button" className={styles.manageButton} onClick={openBanner}>
                Manage cookie preferences
              </button>
              <Text>You can also control or delete cookies in your browser settings. You can still browse key pages and contact us if optional cookies are blocked.</Text>
            </section>

            <section>
              <Heading as="h2" variant="card">How we use it</Heading>
              <ul>
                <li>To respond to your enquiry and provide information or quotes you request.</li>
                <li>To improve our website and services.</li>
              </ul>
            </section>

            <section>
              <Heading as="h2" variant="card">How we store it</Heading>
              <Text>Enquiries and successfully submitted project files may be stored in our private internal systems for follow-up. Access is limited to staff and service providers needed to operate the enquiry process. Abandoned uploads are scheduled for deletion after their short-lived submission binding expires.</Text>
            </section>

            <section>
              <Heading as="h2" variant="card">Sharing and retention</Heading>
              <Text>We do not sell your personal information. We may share it with trusted service providers solely to operate our services. We retain enquiry records as needed to provide service and for our records, unless you ask us to delete them where we can do so.</Text>
            </section>

            <section>
              <Heading as="h2" variant="card">Your choices</Heading>
              <Text>To access, correct or delete your information, email <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>.</Text>
            </section>

            <section>
              <Heading as="h2" variant="card">Contact</Heading>
              <Text>Sanctuary Pergolas · <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a> · <a href="tel:+64228545633">022 854 5633</a></Text>
            </section>
          </div>
        </Container>
      </Section>
    </main>
  );
}
