'use client';

import Link from 'next/link';
import { sections } from '@/data/mega';
import './product.css';
import '../home.css';
import Image from 'next/image';
import JsonLd from '@/components/JsonLd';
import { absoluteUrl } from '@/lib/seo';
import { imagePairFor } from '@/lib/productImages';

export default function ProductsIndex() {
  const pergolaSection = sections.find((s) => s.heading.toLowerCase() === 'pergolas');
  const items = (pergolaSection?.items ?? []).map((i) => ({
    href: i.href,
    title: i.title.replace(/\s*[^\p{L}\p{N}]+\s*$/u, ''),
    desc: i.desc,
    group: 'Pergolas',
  }));

  return (
    <main className="products-index">
      <div className="container">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Products',
            itemListElement: items.map((it, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              url: absoluteUrl(it.href),
              name: it.title,
            })),
          }}
        />
        <header className="products-index__head">
          <p className="product-kicker">Products</p>
          <h1 className="product-title">Pergola styles</h1>
          <p className="product-desc">
            Explore Sanctuary pergola styles, then open a tile to see detailed specs, imagery and installation notes.
          </p>
        </header>
        <div className="products-grid">
          {items.map((it) => {
            const { primary, hover } = imagePairFor(it.href);
            const slug = it.href.split('/').pop() || '';
            return (
              <Link key={it.href} href={it.href} className={`tile${slug === 'hip' ? ' tile--hip' : ''}`}>
                <div className="m">
                  <div className="product-image-stack">
                    <Image
                      src={primary}
                      alt={it.title}
                      fill
                      sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                      className="product-image product-image--base"
                      style={{ objectFit: 'cover' }}
                      priority={false}
                    />
                    <Image
                      src={hover}
                      alt={it.title}
                      fill
                      sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                      className="product-image product-image--hover"
                      style={{ objectFit: 'cover' }}
                      priority={false}
                    />
                  </div>
                </div>
                <p className="k">{it.group}</p>
                <h3 className="t">{it.title}</h3>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
