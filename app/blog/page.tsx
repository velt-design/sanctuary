'use client';

import '@/app/products/product.css';

export default function BlogPage(){
  return (
    <main className="two-col-page">
      <div className="product-split">
        <div className="product-left">
          <div className="product-left-scroller">
            <div className="img-grid">
              <div className="ph-img" />
              <div className="ph-img" />
              <div className="ph-img" />
            </div>
          </div>
        </div>
        <div className="product-right product-rail">
          <div className="product-right-scroller">
            <div className="product-body">
              <div className="product-kicker">Resources</div>
              <h1 className="product-title">Blog</h1>
              <p className="product-desc">Guides, product updates and project write‑ups.</p>
              <div className="product-long">
                <p>Layout suggestion:</p>
                <p>- Left: compact article cards (image + title) in a flowing grid.</p>
                <p>- Right: filters for topics (Pergolas, Screens, Lighting), a search box and featured downloads for architects/builders.</p>
                <p>- Posts open into the same two‑column layout with the article body on the right and pull‑quotes/media on the left.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

