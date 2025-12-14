'use client';

import Image from 'next/image';
import Link from 'next/link';
import { imagePairFor } from '@/lib/productImages';

type HomeProductsSectionProps = {
  blurDataUrl: string;
};

export default function HomeProductsSection({
  blurDataUrl,
}: HomeProductsSectionProps) {
  const pitched = imagePairFor('/products/pergolas/pitched');
  const gable = imagePairFor('/products/pergolas/gable');
  const hip = imagePairFor('/products/pergolas/hip');

  return (
    <>
      <section className="container products-head" aria-label="Products heading">
        <div className="process-head__inner">
          <h2 className="process-head__title">Products</h2>
        </div>
      </section>

      <section className="container" id="products">
        <div className="products-grid">
          <Link className="tile" href="/products/pergolas/pitched">
            <div className="m">
              <div className="product-image-stack">
                <Image
                  src={pitched.primary}
                  alt="Pitched pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--base"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
                <Image
                  src={pitched.hover}
                  alt="Pitched pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--hover"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
              </div>
            </div>
            <p className="k">Pergolas</p>
            <h3 className="t">Pitched</h3>
          </Link>

          <Link className="tile" href="/products/pergolas/gable">
            <div className="m">
              <div className="product-image-stack">
                <Image
                  src={gable.primary}
                  alt="Gable pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--base"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
                <Image
                  src={gable.hover}
                  alt="Gable pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--hover"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
              </div>
            </div>
            <p className="k">Pergolas</p>
            <h3 className="t">Gable</h3>
          </Link>

          <Link className="tile tile--hip" href="/products/pergolas/hip">
            <div className="m">
              <div className="product-image-stack">
                <Image
                  src={hip.primary}
                  alt="Hip pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--base"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
                <Image
                  src={hip.hover}
                  alt="Hip pergola"
                  fill
                  sizes="(max-width: 1280px) 33vw, (max-width: 1024px) 50vw, 25vw"
                  className="product-image product-image--hover"
                  style={{ objectFit: 'cover' }}
                  placeholder="blur"
                  blurDataURL={blurDataUrl}
                />
              </div>
            </div>
            <p className="k">Pergolas</p>
            <h3 className="t">Hip</h3>
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
    </>
  );
}
