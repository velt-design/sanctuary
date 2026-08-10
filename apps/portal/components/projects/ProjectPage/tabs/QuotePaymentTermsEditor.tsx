"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  evaluateQuotePaymentSchedule,
  type QuotePaymentTerm,
} from "@/lib/quotes/paymentSchedule";
import styles from "./QuotePaymentTermsEditor.module.css";

type Props = {
  editable: boolean;
  quoteTotalIncGstCents: number;
  terms: QuotePaymentTerm[];
  setTerms: Dispatch<SetStateAction<QuotePaymentTerm[]>>;
};

function money(cents: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

function newTerm(index: number): QuotePaymentTerm {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? `payment-${crypto.randomUUID()}` : `payment-${Date.now()}-${index}`,
    label: `Payment ${index + 1}`,
    calculationType: "percentage",
    fixedAmountIncGstCents: null,
    percentageOfRemainder: 0,
    resolvedAmountIncGstCents: 0,
  };
}

export default function QuotePaymentTermsEditor({ editable, quoteTotalIncGstCents, terms, setTerms }: Props) {
  const evaluation = evaluateQuotePaymentSchedule(terms, quoteTotalIncGstCents);

  const update = (index: number, patch: Partial<QuotePaymentTerm>) => {
    setTerms((current) => current.map((term, termIndex) => termIndex === index ? { ...term, ...patch } : term));
  };

  return (
    <section className={styles.card} aria-label="Payment schedule">
      <div className={styles.header}>
        <div>
          <h4 className={styles.title}>Payment schedule</h4>
          <p className={styles.note}>Fixed-dollar payments come off first. Percentages then apply to the remaining balance.</p>
        </div>
        {editable ? (
          <button className={styles.addButton} type="button" onClick={() => setTerms((current) => [...current, newTerm(current.length)])} disabled={terms.length >= 10}>
            Add payment
          </button>
        ) : null}
      </div>

      <div className={styles.rows}>
        {evaluation.terms.map((term, index) => (
          <div className={styles.row} key={term.id}>
            <div className={styles.position}>{index + 1}</div>
            <label className={styles.field}>
              <span>Invoice label</span>
              <input value={term.label} disabled={!editable} onChange={(event) => update(index, { label: event.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Type</span>
              <select
                value={term.calculationType}
                disabled={!editable}
                onChange={(event) => update(index, event.target.value === "fixed"
                  ? { calculationType: "fixed", fixedAmountIncGstCents: 0, percentageOfRemainder: null }
                  : { calculationType: "percentage", fixedAmountIncGstCents: null, percentageOfRemainder: 0 })}
              >
                <option value="fixed">Fixed $</option>
                <option value="percentage">% of remaining</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>{term.calculationType === "fixed" ? "Amount (inc GST)" : "Percentage"}</span>
              <input
                inputMode="decimal"
                disabled={!editable}
                value={term.calculationType === "fixed" ? ((term.fixedAmountIncGstCents ?? 0) / 100).toString() : String(term.percentageOfRemainder ?? 0)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  update(index, term.calculationType === "fixed"
                    ? { fixedAmountIncGstCents: Number.isFinite(value) ? Math.round(value * 100) : 0 }
                    : { percentageOfRemainder: Number.isFinite(value) ? value : 0 });
                }}
              />
            </label>
            <div className={styles.resolved}>
              <span>Invoice amount</span>
              <strong>{money(term.resolvedAmountIncGstCents)}</strong>
            </div>
            {editable ? (
              <button className={styles.removeButton} type="button" onClick={() => setTerms((current) => current.filter((_, termIndex) => termIndex !== index))} disabled={terms.length <= 1}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.summary}>
        <span>Fixed: {money(evaluation.fixedTotalIncGstCents)}</span>
        <span>Percentage pool: {money(evaluation.percentagePoolIncGstCents)}</span>
        <span>Allocated: {money(evaluation.allocatedTotalIncGstCents)} of {money(quoteTotalIncGstCents)}</span>
      </div>
      {evaluation.errors.length ? (
        <ul className={styles.errors}>
          {evaluation.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
