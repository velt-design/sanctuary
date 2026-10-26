'use client';
import styles from './EnquiryDraftNotice.module.css';

export default function EnquiryDraftNotice({ hasDraft, warning, onDiscard }: {
  hasDraft: boolean; warning: string | null; onDiscard: () => void;
}) {
  return <div className={styles.notice} data-enquiry-draft data-clarity-mask="true">
    <p><small>Drafts can be restored on this browser for up to 24 hours. <button type="button" disabled={!hasDraft} onClick={onDiscard}>Clear draft</button></small></p>
    {warning && <p role="status">{warning}</p>}
  </div>;
}
