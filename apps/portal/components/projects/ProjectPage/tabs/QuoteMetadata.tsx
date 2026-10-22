import Link from 'next/link';
import type {Dispatch,SetStateAction} from 'react';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
import type {EstimateMeta} from '@/lib/estimates/types';
import {formatDateShort} from './quotesTabModel';
import styles from './QuotesTab.module.css';
type Props={projectId:string;detail:QuoteVersionDetail|null;editableDraft:boolean;draftExpiry:string;setDraftExpiry:Dispatch<SetStateAction<string>>;draftReference:string;setDraftReference:Dispatch<SetStateAction<string>>;hasNewerEstimate:boolean;refreshEstimateTarget:EstimateMeta|null;unknown:string};
/** The same saved-quote field owner renders unknown values until a genuine version exists. */
export default function QuoteMetadata({projectId,detail,editableDraft,draftExpiry,setDraftExpiry,draftReference,setDraftReference,hasNewerEstimate,refreshEstimateTarget,unknown}:Props){return (
<section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Quote details</h4>
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Customer on this quote</div>
                <div className={styles.metaValue}>
                  {detail?detail.customerName||"Customer":unknown}
                </div>
                <div className={styles.metaValueMuted}>
                  {detail?'Saved with this version':unknown}
                </div>
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Current contact</div>
                <div className={styles.metaValue}>
                  {detail?detail.contact.name||"—":unknown}
                </div>
                <div className={styles.metaValueMuted}>
                  {detail?detail.contact.email||"—":unknown}
                </div>
                {detail?.contact.phone ? (
                  <div className={styles.metaValueMuted}>
                    {detail?.contact.phone}
                  </div>
                ) : null}
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Quote number</div>
                <div className={styles.metaValue}>{detail?.quoteRef??unknown}</div>
                <div className={styles.metaValueMuted}>
                  {detail?`v${detail.versionNumber}`:unknown}
                </div>
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Issue date</div>
                <div className={styles.metaValue}>
                  {editableDraft
                    ? "Set on send"
                    : detail?formatDateShort(detail.sentAt):unknown}
                </div>
                <div className={styles.metaLabel}>Expiry date</div>
                {editableDraft ? (
                  <input
                    className={styles.metaInput}
                    type="date"
                    value={draftExpiry}
                    onChange={(e) => setDraftExpiry(e.target.value)}
                    placeholder="30 days from send"
                  />
                ) : (
                  <div className={styles.metaValue}>
                    {detail?detail.expiresAt??"—":unknown}
                  </div>
                )}
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Reference</div>
                {editableDraft ? (
                  <input
                    className={styles.metaInput}
                    value={draftReference}
                    onChange={(e) => setDraftReference(e.target.value)}
                    placeholder="Optional reference"
                  />
                ) : (
                  <div className={styles.metaValue}>
                    {detail?detail.reference||"—":unknown}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Source estimate</div>
              <div className={styles.metaValue}>
                {detail?.sourceEstimateVersionId ? (
                  <Link
                    href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(detail?.sourceEstimateVersionId)}`}
                  >
                    Open estimate {detail?.sourceEstimateVersionLabel}
                  </Link>
                ) : detail?"Manual quote · no source estimate":unknown}
              </div>
              <div className={styles.metaValueMuted}>
                Pricing source:{" "}
                {!detail?unknown:detail.pricingSource === "manual"
                  ? "Admin-entered line items"
                  : detail?.pricingSource === "workbench_solved"
                  ? "Solved design snapshot"
                  : "Calculator estimate snapshot"}
              </div>
              {editableDraft ? (
                <div className={styles.metaNote}>
                  {detail?.pricingSource === "manual"
                    ? "This quote is edited directly and is not linked to calculator pricing."
                    : "Draft quotes are independent once created. Design edits do not overwrite quote wording, pricing, deposit, expiry, or reference unless you explicitly refresh from design."}
                </div>
              ) : null}
              {editableDraft && hasNewerEstimate ? (
                <div className={styles.metaWarning}>
                  A newer design ({refreshEstimateTarget?.versionLabel}) exists.
                  This quote was built from design{" "}
                  {detail?.sourceEstimateVersionLabel}.
                </div>
              ) : null}
            </div>
          </section>
);}
