"use client";

import '@/app/products/product.css';

export default function PrivacyPage(){
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
                  <li>Anonymous usage and performance data (for example page views, browser type, approximate location) via analytics tools such as Google Analytics. These tools may use cookies or similar technologies.</li>
                </ul>

                <h2>Cookies & analytics</h2>
                <p>We may use cookies and similar technologies to keep the site working reliably and to understand how it is used. Analytics cookies help us see which pages are visited, how long visitors stay and which devices are used, so we can improve content and performance. We do not use this information to identify you personally.</p>
                <p>You can control or delete cookies in your browser settings. If you block cookies, some features may not work as intended, but you can still browse key pages and contact us.</p>

                <h2>How we use it</h2>
                <ul>
                  <li>To respond to your enquiry and provide quotes or information you request.</li>
                  <li>To improve our website and services.</li>
                </ul>

                <h2>How we store it</h2>
                <p>Enquiries are delivered to our team via email and may be stored in our internal systems for follow‑up. Access is limited to our staff.</p>

                <h2>Sharing</h2>
                <p>We do not sell your personal information. We may share it with trusted service providers (e.g. email delivery) solely to operate our services.</p>

                <h2>Retention</h2>
                <p>We retain enquiry records as needed to provide service and for our records, unless you ask us to delete them where we can do so.</p>

                <h2>Your choices</h2>
                <p>To access, correct or delete your information, contact us at <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>.</p>

                <h2>Contact</h2>
                <p>Sanctuary Pergolas — <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a> — <a href="tel:+6496349482">+64 9 634 9482</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
