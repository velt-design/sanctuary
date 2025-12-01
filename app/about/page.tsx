'use client';

import '@/app/products/product.css';

export default function AboutPage(){
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
              <div className="product-kicker">About</div>
              <h1 className="product-title">About Sanctuary Pergolas</h1>
              <p className="product-desc">We are a family‑run pergola builder based in Auckland, designing and installing engineered aluminium pergolas across Auckland, Waikato, Bay of Plenty and Northland.</p>
              <div className="product-long">
                <h2>What we do</h2>
                <ul>
                  <li>On‑site custom builds in 1–5 days</li>
                  <li>Typical lead time ~6 weeks</li>
                  <li>Engineer‑signed designs for NZ wind zones</li>
                  <li>10‑year warranty on structure and finish</li>
                </ul>

                <p><strong>400+ pergolas installed since 2016</strong></p>

                <h2>Our story</h2>
                <p>Founder Bruce is an engineering and design teacher turned maker. After struggling to find a well‑built pergola with reasonable lead times, he designed and built his own. Neighbours asked for the same. That workshop project became Sanctuary Pergolas—design‑led outdoor structures, built properly and delivered on time.</p>

                <h2>Why homeowners choose us</h2>
                <ul>
                  <li>Custom, on‑site fit to the millimetre</li>
                  <li>Durable finishes using premium powder‑coat systems</li>
                  <li>Clear communication from consult to handover</li>
                  <li>Council and consent guidance where required</li>
                </ul>

                <h2>Where we work</h2>
                <p>Auckland (metro + surrounds). Projects by request in Hamilton, Waihi, Tauranga and Whangārei.</p>

                <h2>Next step</h2>
                <p>Book a free on‑site consult.</p>
                <p>Phone: <a href="tel:+6496349482">+64 9 634 9482</a>	Email: <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
