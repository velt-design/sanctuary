'use client';

import '@/app/products/product.css';

export default function ResourcesDownloadsPage(){
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
              <div className="product-kicker">Resources</div>
              <h1 className="product-title">Downloads for architects & builders</h1>
              <p className="product-desc">CAD blocks, specification sheets and installation PDFs. Use these to document Sanctuary Pergolas in your projects.</p>

              <div className="product-long">
                <h2 style={{fontSize:16, margin:'10px 0'}}>Architects</h2>
                <ul>
                  <li>CAD: DWG blocks for pergola frames and posts</li>
                  <li>Specs: Word/PDF specification clauses</li>
                  <li>Details: PDF connection details and typical sections</li>
                </ul>
                <h2 style={{fontSize:16, margin:'10px 10px 0 0'}}>Builders</h2>
                <ul>
                  <li>Install guide (PDF) — pitched, gable, hip, box perimeter</li>
                  <li>Fastener schedule and flashings</li>
                  <li>Maintenance sheet for handover packs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

