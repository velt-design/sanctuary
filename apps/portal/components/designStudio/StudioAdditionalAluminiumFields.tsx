"use client";
import { useEffect, useState } from "react";
import type { AdditionalAluminiumCatalogueItem } from "@/lib/costing/additionalAluminiumCatalogue";
import type { StudioJsonObject } from "@/lib/designStudio/contracts";
import Field from "./StudioReviewField";
import css from "./StudioReview.module.css";

type Catalogue =
  | { kind: "loading" }
  | { kind: "ready"; items: AdditionalAluminiumCatalogueItem[] }
  | { kind: "error"; message: string };

/** Discovery only. The existing parent/session owns row edits and deletion;
 * canonical pricing still validates the selected finish and powdercoat. */
export default function StudioAdditionalAluminiumFields({
  rows,
  onChange,
  onRemove,
}: {
  rows: StudioJsonObject[];
  onChange: (id: string, patch: StudioJsonObject) => void;
  onRemove: (id: string) => void;
}) {
  const [catalogue, setCatalogue] = useState<Catalogue>({ kind: "loading" }),
    [attempt, retry] = useState(0),
    enabled = rows.length > 0;
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let live = true;
    setCatalogue({ kind: "loading" });
    void (async () => {
      try {
        const response = await fetch(
          "/api/staff/costing/v1/aluminium-catalogue",
          { cache: "no-store", signal: abort.signal },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw Error(
            typeof body?.error === "string"
              ? body.error
              : "Could not load aluminium profiles.",
          );
        if (
          !Array.isArray(body?.items) ||
          !body.items.every(
            (item: AdditionalAluminiumCatalogueItem) =>
              item &&
              typeof item.profile === "string" &&
              item.profile.length > 0 &&
              Array.isArray(item.stockLengthsM) &&
              item.stockLengthsM.every((n) => Number.isFinite(n) && n > 0),
          )
        )
          throw Error("The aluminium catalogue could not be read.");
        if (live) setCatalogue({ kind: "ready", items: body.items });
      } catch (error) {
        if (live)
          setCatalogue({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not load aluminium profiles.",
          });
      }
    })();
    return () => {
      live = false;
      abort.abort();
    };
  }, [enabled, attempt]);
  if (!enabled) return null;
  const items = catalogue.kind === "ready" ? catalogue.items : [],
    available = catalogue.kind === "ready" && items.length > 0;
  return (
    <>
      <p>
        Profiles and lengths come from the current catalogue. Finish and
        powdercoat availability are checked in the current price.
      </p>
      {catalogue.kind === "loading" && (
        <p role="status">Loading aluminium profiles. Your rows are kept.</p>
      )}
      {(catalogue.kind === "error" ||
        (catalogue.kind === "ready" && !items.length)) && (
        <p role="alert">
          {catalogue.kind === "error"
            ? catalogue.message
            : "No aluminium profiles are available."}{" "}
          Your rows are kept.{" "}
          <button type="button" onClick={() => retry((n) => n + 1)}>
            Retry aluminium profiles
          </button>
        </p>
      )}
      {rows.map((row) => {
        const profile = String(row.profile ?? ""),
          length = String(row.stockLengthM ?? ""),
          selected = items.find((item) => item.profile === profile),
          profiles: [string, string][] = [
            ["", "Select profile"],
            ...items.map((item): [string, string] => [
              item.profile,
              item.profile,
            ]),
          ],
          lengths: [string, string][] = [
            ["", "Select length"],
            ...(selected?.stockLengthsM ?? []).map((n): [string, string] => [
              String(n),
              `${n} m`,
            ]),
          ];
        // Controlled selects must keep exact historical/raw strings, including
        // equivalent spellings such as6.00, until a deliberate choice replaces them.
        if (profile && !profiles.some(([value]) => value === profile))
          profiles.push([profile, `${profile} (retained value)`]);
        if (length && !lengths.some(([value]) => value === length))
          lengths.push([length, `${length} m (retained value)`]);
        const unavailable =
          catalogue.kind === "ready" &&
          ((profile && !selected) ||
            (selected &&
              length &&
              !selected.stockLengthsM.includes(Number(length))));
        return (
          <div className={css.row} key={String(row.id)}>
            <div className={css.grid}>
              <Field
                label="Profile"
                value={profile}
                options={profiles}
                disabled={!available}
                onChange={(value) => {
                  // Same deliberate profile/first-length reconciliation as Calculator.
                  const first = items.find((item) => item.profile === value)
                    ?.stockLengthsM[0];
                  onChange(String(row.id), {
                    profile: value,
                    stockLengthM: first ? String(first) : "",
                  });
                }}
              />
              <Field
                label="Stock length (m)"
                value={length}
                options={lengths}
                disabled={!selected}
                onChange={(value) =>
                  onChange(String(row.id), { stockLengthM: value })
                }
              />
              <Field
                label="Bars"
                value={row.quantity}
                onChange={(value) =>
                  onChange(String(row.id), { quantity: value })
                }
              />
            </div>
            {unavailable && (
              <p>
                This retained profile or length is not in the current catalogue.
                Choose a listed value to replace it; the current price checks
                availability.
              </p>
            )}
            <button type="button" onClick={() => onRemove(String(row.id))}>
              Remove item
            </button>
          </div>
        );
      })}
    </>
  );
}
