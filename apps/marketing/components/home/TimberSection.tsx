'use client';

import Image from 'next/image';

export default function TimberSection() {
  return (
    <section className="timber-section" aria-labelledby="timber-heading">
      <div className="container timber-section__inner">
        <div className="timber-section__image">
          <div className="timber-section__image-frame">
            <Image
              src="/images/project-warkworth-01.png"
              alt="Timber roofing over a Warkworth outdoor space"
              fill
              sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              priority={false}
            />
          </div>
        </div>
        <div className="timber-section__content">
          <p className="product-kicker">Roofing</p>
          <h2 id="timber-heading" className="timber-section__title">
            Timber
          </h2>
          <p className="timber-section__intro">
            Visually it reads like an interior ceiling that’s been extended outdoors, so it ties into timber floors, joinery and furniture and makes the pergola feel like a built-in room rather than a bolt-on cover.
          </p>

          {/* Desktop: inline list; Mobile: collapsible details */}
          <h3 className="timber-section__subhead timber-section__subhead--desktop">Key characteristics</h3>
          <ul className="timber-section__list timber-section__list--desktop">
            <li>
              <strong>Look/feel:</strong> Natural grain, warm colour and a finished ceiling effect; suits higher-end projects or where you want the pergola to feel like an extension of the interior.
            </li>
            <li>
              <strong>Comfort:</strong> Insulated panels plus timber lining give strong heat and glare reduction vs acrylic alone and noticeably soften rain noise and general sound.
            </li>
            <li>
              <strong>Light:</strong> More solid/opaque than acrylic, so it’s often combined with acrylic skylight strips in selected bays to keep daylight levels up.
            </li>
            <li>
              <strong>Maintenance:</strong> Needs periodic oiling or staining to keep the timber looking sharp, and occasional cleaning like any exterior timber; more upkeep than bare aluminium or acrylic but with a more premium, “furnished” result.
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
                  <strong>Look/feel:</strong> Natural grain, warm colour and a finished ceiling effect; suits higher-end projects or where you want the pergola to feel like an extension of the interior.
                </li>
                <li>
                  <strong>Comfort:</strong> Insulated panels plus timber lining give strong heat and glare reduction vs acrylic alone and noticeably soften rain noise and general sound.
                </li>
                <li>
                  <strong>Light:</strong> More solid/opaque than acrylic, so it’s often combined with acrylic skylight strips in selected bays to keep daylight levels up.
                </li>
                <li>
                  <strong>Maintenance:</strong> Needs periodic oiling or staining to keep the timber looking sharp, and occasional cleaning like any exterior timber; more upkeep than bare aluminium or acrylic but with a more premium, “furnished” result.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
