'use client';

import * as React from 'react';
import Link from 'next/link';
import { T } from './_foundation/tokens';
import { Section } from './_foundation/Section';
import { PageShell } from './_foundation/PageShell';
import { DebugFrame } from './_foundation/DebugFrame';
import { MaterialsExplorerStage } from './_sections/MaterialsExplorerStage';

export default function StartExploreClient({ debug }: { debug?: boolean }) {
  return (
    <main className={T.PAGE}>
      {/* Roof strip (layout-only; content will evolve later) */}
      <div className={T.ROOF_WRAP}>
        <PageShell>
          <div className={T.ROOF_INNER}>
            <div className={T.ROOF_LEFT}>
              <div className="text-[12px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Sanctuary Pergolas</div>
              <div className="text-[12px] font-semibold text-[#6e6e73]">Pergola Design</div>
            </div>

            <div className={T.ROOF_RIGHT}>
              <Link className={T.CTA_SECONDARY} href="/start">
                Explore
              </Link>
              <Link className={T.CTA_PRIMARY} href="/contact">
                Contact
              </Link>
            </div>
          </div>
        </PageShell>
      </div>

      {/* Intro header (minimal; keep calm) */}
      <Section>
        <DebugFrame enabled={debug} label="Section: Intro">
          <div className="max-w-[720px]">
            <div className={T.KICKER}>Design chapter</div>
            <h1 className={T.H1}>Take a closer look.</h1>
            <p className={T.LEDE}>
              Calibrated stage + rails + surfaces. This is the foundation skeleton; assets and interactions come next.
            </p>
          </div>
        </DebugFrame>
      </Section>

      <Section tone="tint">
        <MaterialsExplorerStage debug={debug} />
      </Section>
    </main>
  );
}
