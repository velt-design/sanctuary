'use client';

import Image from 'next/image';
import Link from 'next/link';

type HomeProductsSectionProps = {
  blurDataUrl: string;
  revealImages: boolean;
  pitchedLoaded: boolean;
  setPitchedLoaded: (loaded: boolean) => void;
};

export default function HomeProductsSection({
  blurDataUrl,
  revealImages,
  pitchedLoaded,
  setPitchedLoaded,
}: HomeProductsSectionProps) {
  return (
    <section className="container" id="products">
      <div className="section-title">
        <h2>Products</h2>
      </div>
      <div className="products-grid">
        <Link className="tile" href="/products/pergolas/pitched">
          <p className="k">Pergolas</p>
          <h3 className="t">Pitched</h3>
          <div className={`m pitched ${pitchedLoaded && revealImages ? 'in' : ''}`}>
            <Image
              src="/images/product-pitched-01.jpg"
              alt="Pitched pergola"
              fill
              sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
              placeholder="blur"
              blurDataURL={blurDataUrl}
              onLoadingComplete={() => setPitchedLoaded(true)}
            />
          </div>
        </Link>
        <Link className="tile" href="/products/pergolas/gable">
          <p className="k">Pergolas</p>
          <h3 className="t">Gable</h3>
          <div className="m">
            <Image
              src="/images/product-gable-01.jpg"
              alt="Gable pergola"
              fill
              sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
              placeholder="blur"
              blurDataURL={blurDataUrl}
            />
          </div>
        </Link>
        <Link className="tile" href="/products/pergolas/box-perimeter">
          <p className="k">Pergolas</p>
          <h3 className="t">Box Perimeter</h3>
          <div className="m">
            <Image
              src="/images/product-hip-01.jpg"
              alt="Box perimeter pergola"
              fill
              sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
              placeholder="blur"
              blurDataURL={blurDataUrl}
            />
          </div>
        </Link>
        <Link className="tile viewall" href="/products" aria-label="View full range">
          <p className="k">.</p>
          <h3 className="t">.</h3>
          <div className="m">
            <div className="cta-box">
              <div className="cta-title">
                View
                <br />
                full range
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

