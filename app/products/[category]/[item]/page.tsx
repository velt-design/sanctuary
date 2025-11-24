'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { sections } from '@/data/mega';
import '../../product.css';
import { productDescriptions } from '@/data/productDescriptions';
import Image from 'next/image';
import ProductDetails from '@/components/ProductDetails';
import { productContent } from '@/data/productContent';

const norm = (s: string) => s.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');

export default function ProductItemPage() {
  const params = useParams<{ category: string; item: string }>();
  const category = (params?.category as unknown as string) || '';
  const item = (params?.item as unknown as string) || '';

  const data = useMemo(() => {
    const sec = sections.find(s => norm(s.heading) === category);
    if (!sec) return null;
    const it = sec.items.find(i => i.href.split('/').pop() === item);
    return it ? { section: sec.heading, item: it } : null;
  }, [category, item]);

  if (!data) {
    return (
      <main className="product-page">
        <div className="product-split">
          <div className="product-left">
            <div className="img-grid">
              <div className="ph-img" />
              <div className="ph-img" />
              <div className="ph-img" />
            </div>
          </div>
          <div className="product-right product-rail">
            <div className="product-body">
              <h1 className="product-title">Not found</h1>
              <p className="product-desc">Unknown product.</p>
              <Link className="btn" href="/products">Back to products</Link>
              <div className="text-grid">
                <div className="ph-text" />
                <div className="ph-text" />
                <div className="ph-text" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const slug = item;
  const long = productDescriptions[slug];
  const structured = productContent[slug as keyof typeof productContent];
  // Image selections for known products using assets in public/images
  const productImages: string[] = useMemo(() => {
    switch (slug) {
      case 'led-strip-lighting':
        return [
          '/images/project-kiwi-rail-02.jpg',
          '/images/project-kiwi-rail-01.jpg',
          '/images/project-kiwi-rail-03.jpg',
        ];
      case 'pitched':
        return [
          '/images/product-pitched-01.jpg',
          '/images/pitched-01.jpg',
          '/images/hero-1.jpg',
        ];
      case 'gable':
        return [
          '/images/product-gable-01.jpg',
          '/images/project-velskov-01.jpg',
          '/images/hero-2.jpg',
        ];
      case 'hip':
        return [
          '/images/product-hip-01.jpg',
          '/images/project-velskov-02.jpg',
          '/images/project-westmere-01.jpg',
        ];
      case 'box-perimeter':
        return [
          '/images/product-perimeter-01.jpg',
          '/images/perimeter-01.jpg',
          '/images/project-goodhome-01.jpg',
        ];
      default:
        return ['/images/hero-1.jpg', '/images/hero-2.jpg'];
    }
  }, [slug]);

  return (
    <main className="product-page">
      <div className="product-split">
        <div className="product-left">
          <div className="product-left-scroller">
            <div className="img-grid">
            {productImages.map((src, idx) => (
              <div className="ph-img" key={src}>
                <Image
                  src={src}
                  alt={`${data.item.title.replace(/\s*→\s*$/, '')} view ${idx + 1}`}
                  fill
                  sizes="(max-width: 960px) 100vw, 66vw"
                  priority={idx === 0}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ))}
            </div>
          </div>
        </div>
        <div className="product-right product-rail">
          <div className="product-right-scroller">
            <div className="product-body">
            <div className="product-kicker product-kicker--wipe">{data.section === 'Screens & walls' ? 'Slats & Screens' : data.section}</div>
            <h1 className="product-title">{data.item.title.replace(/\s*→\s*$/, '')}</h1>
            <p className="product-desc">{data.item.desc}</p>
            <div className="product-actions">
              <Link className="btn" href="/contact">Get a free quote</Link>
              <Link className="btn" href="/contact">Contact</Link>
            </div>
            {structured ? (
              <div className="product-long"><ProductDetails content={structured} /></div>
            ) : (
              long && (
                <div className="product-long">
                  {long.split(/\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )
            )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
