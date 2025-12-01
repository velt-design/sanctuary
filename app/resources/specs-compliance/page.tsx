'use client';

import '@/app/products/product.css';
import type { CSSProperties } from 'react';

export default function ResourcesSpecsCompliancePage() {
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
              <div className="product-kicker">Specs &amp; compliance</div>
              <h1 className="product-title">Specifications</h1>
              <p className="product-desc">Engineering-ready structure for prototyping. Replace placeholder values with project-specific calcs and producer statements before use.</p>

              <div className="product-long">
                <section aria-labelledby="eng-notes">
                  <h2 id="eng-notes" style={{fontSize: 18, margin: '18px 0 6px'}}>Engineering notes</h2>

                  <h3 style={{fontSize: 16, margin: '10px 0'}}>Typical spans (example only — verify per site)</h3>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr>
                        <th style={th}>Roofing</th>
                        <th style={th}>Rafter spacing</th>
                        <th style={th}>Rafter span</th>
                        <th style={th}>Beam span</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Acrylic 8 mm</td>
                        <td style={td}>600–900 mm</td>
                        <td style={td}>2.4–3.0 m</td>
                        <td style={td}>3.0–3.6 m</td>
                        <td style={td}>Depends on wind/snow loads</td>
                      </tr>
                      <tr>
                        <td style={td}>Insulated 50 mm</td>
                        <td style={td}>900–1200 mm</td>
                        <td style={td}>3.6–4.2 m</td>
                        <td style={td}>4.0–4.8 m</td>
                        <td style={td}>Panel manufacturer tables govern</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 style={{fontSize: 16, margin: '18px 0 6px'}}>Wind zones (NZS 3604 reference — example mapping)</h3>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr>
                        <th style={th}>Zone</th>
                        <th style={th}>Fixings</th>
                        <th style={th}>Bracing</th>
                        <th style={th}>Max bay width</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Low–Medium</td>
                        <td style={td}>✓ standard</td>
                        <td style={td}>Std</td>
                        <td style={td}>up to 3.6 m</td>
                        <td style={td}>Sheltered sites</td>
                      </tr>
                      <tr>
                        <td style={td}>High</td>
                        <td style={td}>✓ upgraded</td>
                        <td style={td}>Increased</td>
                        <td style={td}>up to 3.0 m</td>
                        <td style={td}>Edge exposure</td>
                      </tr>
                      <tr>
                        <td style={td}>Very High</td>
                        <td style={td}>✓ engineered</td>
                        <td style={td}>Engineered</td>
                        <td style={td}>up to 2.4 m</td>
                        <td style={td}>Site calc required</td>
                      </tr>
                      <tr>
                        <td style={td}>Extra High / SD</td>
                        <td style={td}>✓ specific design</td>
                        <td style={td}>Specific</td>
                        <td style={td}>by calc</td>
                        <td style={td}>Producer statement</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 style={{fontSize: 16, margin: '18px 0 6px'}}>Member sizing (example only)</h3>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr>
                        <th style={th}>Member</th>
                        <th style={th}>Material</th>
                        <th style={th}>Typical size</th>
                        <th style={th}>Finish</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Posts</td>
                        <td style={td}>Aluminium</td>
                        <td style={td}>100×100×3 mm</td>
                        <td style={td}>Powder-coated</td>
                        <td style={td}>Footing per soil report</td>
                      </tr>
                      <tr>
                        <td style={td}>Beams</td>
                        <td style={td}>Aluminium</td>
                        <td style={td}>150×50×3 mm</td>
                        <td style={td}>Powder-coated</td>
                        <td style={td}>Deflection L/250</td>
                      </tr>
                      <tr>
                        <td style={td}>Rafters</td>
                        <td style={td}>Aluminium</td>
                        <td style={td}>100×50×3 mm</td>
                        <td style={td}>Powder-coated</td>
                        <td style={td}>Spacing per roof option</td>
                      </tr>
                    </tbody>
                  </table>

                  <p style={{marginTop: 10, color: '#6D7176'}}>
                    <strong>Warning note:</strong> All figures are placeholders for layout. Use project-specific engineering and local authority requirements.
                  </p>
                </section>

                <section aria-labelledby="consent-compliance" style={{marginTop: 24}}>
                  <h2 id="consent-compliance" style={{fontSize: 18, margin: '6px 0'}}>Consent &amp; compliance</h2>

                  <h3 style={{fontSize: 16, margin: '10px 0'}}>Drainage &amp; falls</h3>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr>
                        <th style={th}>Element</th>
                        <th style={th}>Spec</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Gutter type</td>
                        <td style={td}>Internal box</td>
                        <td style={td}>Integrated to pergola frame</td>
                      </tr>
                      <tr>
                        <td style={td}>Fall</td>
                        <td style={td}>1:100–1:60</td>
                        <td style={td}>Toward outlets</td>
                      </tr>
                      <tr>
                        <td style={td}>Outlet</td>
                        <td style={td}>65–80 mm</td>
                        <td style={td}>Per downpipe capacity</td>
                      </tr>
                      <tr>
                        <td style={td}>Overflow</td>
                        <td style={td}>Yes</td>
                        <td style={td}>Scupper or rainhead</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 style={{fontSize: 16, margin: '18px 0 6px'}}>Warranty summary</h3>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr>
                        <th style={th}>Component</th>
                        <th style={th}>Coverage</th>
                        <th style={th}>Term</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={td}>Structure</td>
                        <td style={td}>Manufacturing defects</td>
                        <td style={td}>10 years</td>
                        <td style={td}>Subject to maintenance</td>
                      </tr>
                      <tr>
                        <td style={td}>Powder coat</td>
                        <td style={td}>Film integrity / colour</td>
                        <td style={td}>15 years</td>
                        <td style={td}>Duralloy® conditions apply</td>
                      </tr>
                      <tr>
                        <td style={td}>Roof panels</td>
                        <td style={td}>Material warranty</td>
                        <td style={td}>10–20 years</td>
                        <td style={td}>Per supplier T&amp;Cs</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 style={{fontSize: 16, margin: '18px 0 6px'}}>Consent checklist</h3>
                  <ul>
                    <li>Work within exemptions or obtain consent per NZ Building Act.</li>
                    <li>Engineer’s PS1 for Extra High/Specific Design wind zones.</li>
                    <li>Fixings, bracing, and foundations to NZS 3604 / site-specific design.</li>
                    <li>Stormwater connection per local council requirements.</li>
                    <li>Durability and maintenance statements supplied to client.</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const th: CSSProperties = {
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)'
};

const td: CSSProperties = {
  textAlign: 'left',
  fontSize: 14,
  padding: '8px 10px',
  borderTop: '1px solid var(--border)'
};
