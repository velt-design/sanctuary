'use client';

import Image from 'next/image';

export default function AcrylicSection() {
  return (
    <section className="timber-section" aria-labelledby="acrylic-heading">
      <div className="container timber-section__inner">
        <div className="timber-section__image">
          <div className="timber-section__image-frame">
            <Image
              src="/images/project-dairy-flat-02.jpg"
              alt="Acrylic roof over an outdoor dining area"
              fill
              sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              priority={false}
            />
          </div>
        </div>
        <div className="timber-section__content">
          <p className="product-kicker">Roofing</p>
          <h2 id="acrylic-heading" className="timber-section__title">
            Acrylic
          </h2>
          <p className="timber-section__intro">
            Clear or tinted acrylic sheets that keep the pergola light and open while blocking UV and rain.
          </p>

          {/* Desktop: inline list; Mobile: collapsible details */}
          <h3 className="timber-section__subhead timber-section__subhead--desktop">Key characteristics</h3>
          <ul className="timber-section__list timber-section__list--desktop">
            <li>
              <strong>Look/feel:</strong> Light, crisp roofline that keeps sky views and a clean, modern read.
            </li>
            <li>
              <strong>Comfort:</strong> Good rain protection with moderate heat and glare control depending on tint.
            </li>
            <li>
              <strong>Light:</strong> High daylight transmission; clear feels almost open, tints soften brightness and
              reduce glare.
            </li>
            <li>
              <strong>Maintenance:</strong> Occasional washing to remove dust and debris; no recoating required, but
              avoid harsh abrasives to keep the surface clear.
            </li>
          </ul>

          <details className="timber-section__details timber-section__details--mobile">
            <summary className="timber-section__summary">
              <span>Key characteristics</span>
              <span aria-hidden="true" className="timber-section__summary-icon">+</span>
            </summary>
            <div className="timber-section__panel">
              <ul className="timber-section__list">
                <li>
                  <strong>Look/feel:</strong> Light, crisp roofline that keeps sky views and a clean, modern read.
                </li>
                <li>
                  <strong>Comfort:</strong> Good rain protection with moderate heat and glare control depending on tint.
                </li>
                <li>
                  <strong>Light:</strong> High daylight transmission; clear feels almost open, tints soften brightness
                  and reduce glare.
                </li>
                <li>
                  <strong>Maintenance:</strong> Occasional washing to remove dust and debris; no recoating required, but
                  avoid harsh abrasives to keep the surface clear.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
