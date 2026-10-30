"use client";
import type { ReactNode } from "react";
import type { WebsitePrice } from "./useStudioWebsitePrice";
import css from "./StudioWebsite.module.css";

/** Subtotal/status presentation only. Existing Workspace owners supply actions;
 * no selection, transaction, pricing request or movement authority lives here. */
export default function StudioWorkspaceSubtotal({
  houseInputNotice,
  provisional,
  invalid,
  invalidSelection,
  invalidJoin,
  arrangementError,
  products,
  price,
  children,
}: {
  houseInputNotice: string | null;
  provisional: boolean;
  invalid:
    | { studioAttachment?: unknown; error: string | null }
    | null
    | undefined;
  invalidSelection: { label: string } | null | undefined;
  invalidJoin: boolean;
  arrangementError: string | null;
  products: readonly unknown[];
  price: { price: WebsitePrice | null; error: string | null };
  children: ReactNode;
}) {
  return (
    <div className={`${css.price} ${css.housePrice}`}>
      <span>Design subtotal · including GST</span>
      <strong
        data-recovery={
          Boolean(invalid || arrangementError || provisional) || undefined
        }
      >
        {provisional
          ? "Preview only"
          : invalid
            ? (invalidSelection?.label ??
              (invalid.studioAttachment ? "Check connection" : "Check pergola"))
            : invalidJoin
              ? "Check join"
              : arrangementError
                ? "Check placement"
                : !products.length
                  ? "Add a pergola"
                  : price.price?.status === "priced"
                    ? new Intl.NumberFormat("en-NZ", {
                        style: "currency",
                        currency: "NZD",
                        maximumFractionDigits: 0,
                      }).format(price.price.amount!)
                    : price.error || price.price?.status === "unavailable"
                      ? "Unavailable"
                      : "Calculating…"}
      </strong>
      <div className={css.housePriceStatus}>
        <small tabIndex={0} aria-label="Design pricing status">
          {houseInputNotice ??
            (provisional
              ? "Complete the connection choice or cancel to return to the current design."
              : invalid
                ? invalid.error
                : (arrangementError ??
                  price.error ??
                  (price.price?.status === "unavailable"
                    ? price.price.reason ?? "Design price unavailable."
                    : null) ??
                  (price.price?.versionNumber
                    ? `Current Pricebook ${price.price.versionNumber}`
                    : " ")))}
        </small>
        {children}
      </div>
    </div>
  );
}
