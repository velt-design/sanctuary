"use client";

import React from "react";
import Image from "next/image";

export type FAQ = { q: string; a: string };

export type ProductContent = {
  overview: string;
  atAGlance: string[];
  howItWorks?: string;
  whyItsGood?: string[] | string;
  structureMaterials?: string[];
  options?: string[];
  performance?: string[];
  recommendedFor?: string[];
  notIdealFor?: string[];
  install?: string[];
  maintenance?: string[];
  upgradePath?: string[];
  bestPairedWith?: string[];
  indicativePerformance?: string[];
  faqs?: FAQ[];
  /** Optional inline image to show after the "Why it's good" section */
  imageAfterWhy?: { src: string; alt?: string };
};

type Props = {
  content: ProductContent;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="product-section">
      <h2 className="product-section-title">{title}</h2>
      <div className="product-section-body">{children}</div>
    </section>
  );
}

export default function ProductDetails({ content }: Props) {
  const {
    overview,
    atAGlance,
    howItWorks,
    whyItsGood,
    structureMaterials,
    options,
    performance,
    recommendedFor,
    notIdealFor,
    install,
    maintenance,
    upgradePath,
    bestPairedWith,
    indicativePerformance,
    faqs,
    imageAfterWhy,
  } = content;

  const Bullets = ({ items }: { items?: string[] }) =>
    items && items.length ? (
      <ul className="product-bullets">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    ) : null;

  return (
    <div className="product-sections">
      <p className="product-overview">{overview}</p>

      <Section title="At a glance">
        <Bullets items={atAGlance} />
      </Section>

      {howItWorks && (
        <Section title="How it works">
          <p>{howItWorks}</p>
        </Section>
      )}

      {whyItsGood && (
        <Section title="Why it's good">
          {Array.isArray(whyItsGood) ? <Bullets items={whyItsGood} /> : <p>{whyItsGood}</p>}
        </Section>
      )}

      {/* Optional inline media between Why and Structure */}
      {imageAfterWhy && (
        <div className="ph-img product-inline-media">
          <Image
            src={imageAfterWhy.src}
            alt={imageAfterWhy.alt || "Product image"}
            fill
            sizes="(max-width: 960px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}

      {structureMaterials && (
        <Section title="Structure & materials">
          <Bullets items={structureMaterials} />
        </Section>
      )}

      {options && (
        <Section title="Options">
          <Bullets items={options} />
        </Section>
      )}

      {performance && (
        <Section title="Performance">
          <Bullets items={performance} />
        </Section>
      )}

      {recommendedFor && (
        <Section title="Best for">
          <Bullets items={recommendedFor} />
        </Section>
      )}

      {notIdealFor && (
        <Section title="Not ideal for">
          <Bullets items={notIdealFor} />
        </Section>
      )}

      {(install || maintenance) && (
        <Section title="Install & maintenance">
          <Bullets items={[...(install || []), ...(maintenance || [])]} />
        </Section>
      )}

      {upgradePath && (
        <Section title="Upgrade path">
          <Bullets items={upgradePath} />
        </Section>
      )}

      {bestPairedWith && (
        <Section title="Best paired with">
          <Bullets items={bestPairedWith} />
        </Section>
      )}

      {indicativePerformance && (
        <Section title="Indicative performance">
          <Bullets items={indicativePerformance} />
        </Section>
      )}

      {faqs && faqs.length > 0 && (
        <Section title="FAQs">
          <div className="product-faqs">
            {faqs.map((f, i) => (
              <details key={i} className="product-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
