"use client";

import '@/app/products/product.css';
import { useConsent } from '@/components/ConsentProvider';

export default function PrivacyPage(){
  const { openBanner } = useConsent();

  return (
    <main className="two-col-page">
      <div className="product-split">
        <div className="product-left">
          <div className="product-left-scroller">
            <div className="img-grid">
              <div className="ph-img" />
              <div className="ph-img" />
            </div>
          </div>
        </div>
        <div className="product-right product-rail">
          <div className="product-right-scroller">
            <div className="product-body">
              <div className="product-kicker">Privacy</div>
              <h1 className="product-title">Privacy Policy</h1>
              <p className="product-desc">How we collect, use and protect your information.</p>

              <div className="product-long">
                <h2>Summary</h2>
                <p>We collect only the information needed to respond to your enquiry and improve our website. We do not sell your data.</p>

                <h2>What we collect</h2>
                <ul>
                  <li>Contact details you submit (e.g. name, email, suburb) and project notes.</li>
                  <li>Optional project details (sizes, style preferences, roof/add‑ons) you include in the form.</li>
                  <li>Optional usage, performance and campaign-attribution data (for example page views, browser type, approximate location and advertising click identifiers) only after the relevant consent.</li>
                  <li>Project files you choose to upload, such as photos, plans or sketches.</li>
                </ul>

                <h2>Cookies & analytics</h2>
                <p>We use three categories of cookies: essential, analytics, and marketing.</p>
                <ul>
                  <li>Essential cookies keep core site functions working.</li>
                  <li>Analytics cookies help us understand usage and improve performance.</li>
                  <li>Marketing cookies support campaign measurement and advertising attribution.</li>
                </ul>
                <p>Google Analytics loads only with analytics consent. Meta and ArchiPro load only with marketing consent. Google Tag Manager can dispatch both categories, so it loads only after you accept at least one relevant category and keeps any category you declined disabled. Declining all optional cookies does not load those vendor resources.</p>
                <p>
                  <button type="button" className="privacy-cookie-manage" onClick={openBanner}>
                    Manage cookie preferences
                  </button>
                </p>
                <p>You can also control or delete cookies in your browser settings. If you block cookies, some features may not work as intended, but you can still browse key pages and contact us.</p>

                <h2>How we use it</h2>
                <ul>
                  <li>To respond to your enquiry and provide quotes or information you request.</li>
                  <li>To improve our website and services.</li>
                </ul>

                <h2>How we store it</h2>
                <p>Enquiries and successfully submitted project files may be stored in our private internal systems for follow‑up. Access is limited to our staff and service providers needed to operate the enquiry process. Abandoned uploads use a short-lived submission binding and are scheduled for deletion after that binding expires.</p>

                <h2>Sharing</h2>
                <p>We do not sell your personal information. We may share it with trusted service providers (e.g. email delivery) solely to operate our services.</p>

                <h2>Retention</h2>
                <p>We retain enquiry records as needed to provide service and for our records, unless you ask us to delete them where we can do so.</p>

                <h2>Your choices</h2>
                <p>To access, correct or delete your information, contact us at <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>.</p>

                <h2>Contact</h2>
                <p>Sanctuary Pergolas — <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a> — <a href="tel:+64228545633">022 854 5633</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
