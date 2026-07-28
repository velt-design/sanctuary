"use client";

import type { Dispatch, SetStateAction } from "react";
import type { QuoteLineItem } from "@/lib/quotes/types";
import {
  buildPergolaStructuredDescription,
  parsePergolaStructuredDescription,
  type PergolaFieldMap,
  type PergolaModuleDraft,
} from "@/lib/quotes/pergolaDraft";
import styles from "./QuotesTab.module.css";
import {
  formatMoneyFromCents,
  formatMoneyInputValue,
  isPergolaLineItemDescription,
  parseQtyInput,
  sanitizeMoneyInput,
} from "./quotesTabModel";

type Setter<T> = Dispatch<SetStateAction<T>>;

type QuoteLineItemsEditorProps = {
  editable: boolean;
  draftItems: QuoteLineItem[];
  setDraftItems: Setter<QuoteLineItem[]>;
  unitInputDrafts: Record<string, string>;
  setUnitInputDrafts: Setter<Record<string, string>>;
  activeUnitInputId: string | null;
  setActiveUnitInputId: Setter<string | null>;
  getLiveUnitPriceIncGstCents: (item: QuoteLineItem) => number;
  parsedPergolaDrafts: Map<
    string,
    ReturnType<typeof parsePergolaStructuredDescription>
  >;
  draftPergolaOverrideMode: Record<string, boolean>;
  setDraftPergolaOverrideMode: Setter<Record<string, boolean>>;
  updateDraftItemDescription: (itemId: string, description: string) => void;
  updatePergolaModule: (
    itemId: string,
    moduleIndex: number,
    updater: (module: PergolaModuleDraft) => PergolaModuleDraft,
  ) => void;
  updatePergolaSharedField: (
    itemId: string,
    key: keyof PergolaFieldMap,
    value: string,
  ) => void;
  commitUnitPriceDraft: (itemId: string, rawValue: string) => void;
  moveRow: (index: number, direction: -1 | 1) => void;
  deleteRow: (index: number) => void;
  addRow: () => void;
};

export default function QuoteLineItemsEditor({
  editable,
  draftItems,
  setDraftItems,
  unitInputDrafts,
  setUnitInputDrafts,
  activeUnitInputId,
  setActiveUnitInputId,
  getLiveUnitPriceIncGstCents,
  parsedPergolaDrafts,
  draftPergolaOverrideMode,
  setDraftPergolaOverrideMode,
  updateDraftItemDescription,
  updatePergolaModule,
  updatePergolaSharedField,
  commitUnitPriceDraft,
  moveRow: handleMoveRow,
  deleteRow: handleDeleteRow,
  addRow: handleAddRow,
}: QuoteLineItemsEditorProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>Line items</h4>
        {editable ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleAddRow}
          >
            Add row
          </button>
        ) : null}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.lineTable}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit (inc GST)</th>
              <th>Amount</th>
              {editable ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {draftItems.map((item, idx) => {
              const unitInputValue =
                unitInputDrafts[item.id] ??
                (activeUnitInputId === item.id
                  ? formatMoneyInputValue(item.unitPriceIncGstCents)
                  : formatMoneyFromCents(item.unitPriceIncGstCents).replace(
                      "$",
                      "",
                    ));
              const liveUnitPriceIncGstCents =
                editable
                  ? getLiveUnitPriceIncGstCents(item)
                  : item.unitPriceIncGstCents;
              const lineTotal = Math.round(
                (Number.isFinite(item.qty) ? item.qty : 0) *
                  liveUnitPriceIncGstCents,
              );
              const parsedPergola = parsedPergolaDrafts.get(item.id) ?? null;
              const pergolaOverride = Boolean(
                draftPergolaOverrideMode[item.id],
              );
              const canUseStructuredPergola =
                editable && parsedPergola && !pergolaOverride;
              return (
                <tr key={item.id}>
                  <td>
                    {editable ? (
                      <div className={styles.lineEditorCell}>
                        {canUseStructuredPergola ? (
                          <div className={styles.structuredPergolaEditor}>
                            <div className={styles.structuredPergolaToolbar}>
                              <span className={styles.structuredPergolaLabel}>
                                Structured pergola editor
                              </span>
                              <button
                                type="button"
                                className={styles.rowButton}
                                onClick={() =>
                                  setDraftPergolaOverrideMode((prev) => ({
                                    ...prev,
                                    [item.id]: true,
                                  }))
                                }
                              >
                                Advanced text override
                              </button>
                            </div>
                            <label className={styles.metaLabel}>
                              Pergola heading
                            </label>
                            <input
                              className={styles.metaInput}
                              value={parsedPergola.heading}
                              onChange={(e) =>
                                updateDraftItemDescription(
                                  item.id,
                                  buildPergolaStructuredDescription({
                                    ...parsedPergola,
                                    heading: e.target.value,
                                  }),
                                )
                              }
                            />
                            {parsedPergola.modules.length > 1 ? (
                              <>
                                <label className={styles.metaLabel}>
                                  Configuration
                                </label>
                                <input
                                  className={styles.metaInput}
                                  value={parsedPergola.configuration}
                                  onChange={(e) =>
                                    updateDraftItemDescription(
                                      item.id,
                                      buildPergolaStructuredDescription({
                                        ...parsedPergola,
                                        configuration: e.target.value,
                                      }),
                                    )
                                  }
                                />
                                <div className={styles.pergolaSectionCard}>
                                  <div className={styles.pergolaSectionTitle}>
                                    Shared specification
                                  </div>
                                  <div className={styles.pergolaFieldGrid}>
                                    {(
                                      [
                                        "roof",
                                        "colour",
                                        "houseConnection",
                                        "postFixings",
                                      ] as const
                                    ).map((fieldKey) => (
                                      <label
                                        key={fieldKey}
                                        className={styles.pergolaField}
                                      >
                                        <span className={styles.metaLabel}>
                                          {fieldKey === "houseConnection"
                                            ? "House connection"
                                            : fieldKey === "postFixings"
                                              ? "Post fixings"
                                              : fieldKey
                                                  .charAt(0)
                                                  .toUpperCase() +
                                                fieldKey.slice(1)}
                                        </span>
                                        <input
                                          className={styles.metaInput}
                                          value={parsedPergola.shared[fieldKey]}
                                          onChange={(e) =>
                                            updatePergolaSharedField(
                                              item.id,
                                              fieldKey,
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : null}
                            <div className={styles.pergolaModuleList}>
                              {parsedPergola.modules.map(
                                (module, moduleIndex) => (
                                  <div
                                    key={`${item.id}:module:${moduleIndex}`}
                                    className={styles.pergolaSectionCard}
                                  >
                                    <div className={styles.pergolaSectionTitle}>
                                      {module.title ||
                                        `Module ${moduleIndex + 1}`}
                                    </div>
                                    <div className={styles.pergolaFieldGrid}>
                                      <label className={styles.pergolaField}>
                                        <span className={styles.metaLabel}>
                                          Type / style
                                        </span>
                                        <input
                                          className={styles.metaInput}
                                          value={module.style}
                                          onChange={(e) =>
                                            updatePergolaModule(
                                              item.id,
                                              moduleIndex,
                                              (current) => ({
                                                ...current,
                                                style: e.target.value,
                                              }),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className={styles.pergolaField}>
                                        <span className={styles.metaLabel}>
                                          Size
                                        </span>
                                        <input
                                          className={styles.metaInput}
                                          value={module.size}
                                          onChange={(e) =>
                                            updatePergolaModule(
                                              item.id,
                                              moduleIndex,
                                              (current) => ({
                                                ...current,
                                                size: e.target.value,
                                              }),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className={styles.pergolaField}>
                                        <span className={styles.metaLabel}>
                                          Pitch / slope
                                        </span>
                                        <input
                                          className={styles.metaInput}
                                          value={module.pitch}
                                          onChange={(e) =>
                                            updatePergolaModule(
                                              item.id,
                                              moduleIndex,
                                              (current) => ({
                                                ...current,
                                                pitch: e.target.value,
                                              }),
                                            )
                                          }
                                        />
                                      </label>
                                      <label className={styles.pergolaField}>
                                        <span className={styles.metaLabel}>
                                          Posts
                                        </span>
                                        <input
                                          className={styles.metaInput}
                                          value={module.posts}
                                          onChange={(e) =>
                                            updatePergolaModule(
                                              item.id,
                                              moduleIndex,
                                              (current) => ({
                                                ...current,
                                                posts: e.target.value,
                                              }),
                                            )
                                          }
                                        />
                                      </label>
                                      {!parsedPergola.shared.roof.trim() ? (
                                        <label className={styles.pergolaField}>
                                          <span className={styles.metaLabel}>
                                            Roof
                                          </span>
                                          <input
                                            className={styles.metaInput}
                                            value={module.roof}
                                            onChange={(e) =>
                                              updatePergolaModule(
                                                item.id,
                                                moduleIndex,
                                                (current) => ({
                                                  ...current,
                                                  roof: e.target.value,
                                                }),
                                              )
                                            }
                                          />
                                        </label>
                                      ) : null}
                                      {!parsedPergola.shared.colour.trim() ? (
                                        <label className={styles.pergolaField}>
                                          <span className={styles.metaLabel}>
                                            Colour
                                          </span>
                                          <input
                                            className={styles.metaInput}
                                            value={module.colour}
                                            onChange={(e) =>
                                              updatePergolaModule(
                                                item.id,
                                                moduleIndex,
                                                (current) => ({
                                                  ...current,
                                                  colour: e.target.value,
                                                }),
                                              )
                                            }
                                          />
                                        </label>
                                      ) : null}
                                      {!parsedPergola.shared.houseConnection.trim() ? (
                                        <label className={styles.pergolaField}>
                                          <span className={styles.metaLabel}>
                                            House connection
                                          </span>
                                          <input
                                            className={styles.metaInput}
                                            value={module.houseConnection}
                                            onChange={(e) =>
                                              updatePergolaModule(
                                                item.id,
                                                moduleIndex,
                                                (current) => ({
                                                  ...current,
                                                  houseConnection:
                                                    e.target.value,
                                                }),
                                              )
                                            }
                                          />
                                        </label>
                                      ) : null}
                                      {!parsedPergola.shared.postFixings.trim() ? (
                                        <label className={styles.pergolaField}>
                                          <span className={styles.metaLabel}>
                                            Post fixings
                                          </span>
                                          <input
                                            className={styles.metaInput}
                                            value={module.postFixings}
                                            onChange={(e) =>
                                              updatePergolaModule(
                                                item.id,
                                                moduleIndex,
                                                (current) => ({
                                                  ...current,
                                                  postFixings: e.target.value,
                                                }),
                                              )
                                            }
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {isPergolaLineItemDescription(item.description) ? (
                              <div className={styles.structuredPergolaToolbar}>
                                <span className={styles.structuredPergolaLabel}>
                                  {parsedPergola
                                    ? "Advanced text override"
                                    : "Manual pergola text"}
                                </span>
                                {parsedPergola ? (
                                  <button
                                    type="button"
                                    className={styles.rowButton}
                                    onClick={() =>
                                      setDraftPergolaOverrideMode((prev) => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                      })
                                    }
                                  >
                                    Return to structured editor
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            <textarea
                              className={styles.textarea}
                              value={item.description}
                              onChange={(e) =>
                                updateDraftItemDescription(
                                  item.id,
                                  e.target.value,
                                )
                              }
                              rows={6}
                            />
                            {isPergolaLineItemDescription(item.description) &&
                            !parsedPergola ? (
                              <div className={styles.metaWarning}>
                                This row is using manual pergola text. Return to
                                the structured editor after the text matches the
                                supported pergola format.
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className={styles.readonlyBlock}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <input
                        className={styles.numberInput}
                        value={String(item.qty)}
                        onChange={(e) =>
                          setDraftItems((prev) =>
                            prev.map((entry, i) =>
                              i === idx
                                ? {
                                    ...entry,
                                    qty: parseQtyInput(e.target.value),
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                    ) : (
                      <div>{item.qty}</div>
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <input
                        className={styles.numberInput}
                        value={unitInputValue}
                        inputMode="decimal"
                        onPointerDown={(e) => {
                          if (e.currentTarget === document.activeElement)
                            return;
                          e.preventDefault();
                          e.currentTarget.focus();
                          e.currentTarget.select();
                        }}
                        onChange={(e) =>
                          setUnitInputDrafts((prev) => ({
                            ...prev,
                            [item.id]: sanitizeMoneyInput(e.target.value),
                          }))
                        }
                        onFocus={(e) => {
                          const inputEl = e.currentTarget;
                          setActiveUnitInputId(item.id);
                          setUnitInputDrafts((prev) => {
                            if (typeof prev[item.id] === "string") return prev;
                            return {
                              ...prev,
                              [item.id]: formatMoneyInputValue(
                                item.unitPriceIncGstCents,
                              ),
                            };
                          });
                          window.requestAnimationFrame(() => {
                            if (
                              !inputEl.isConnected ||
                              document.activeElement !== inputEl
                            )
                              return;
                            inputEl.select();
                          });
                        }}
                        onBlur={(e) => {
                          setActiveUnitInputId((prev) =>
                            prev === item.id ? null : prev,
                          );
                          commitUnitPriceDraft(item.id, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          commitUnitPriceDraft(item.id, e.currentTarget.value);
                          e.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <div>
                        {formatMoneyFromCents(item.unitPriceIncGstCents)}
                      </div>
                    )}
                  </td>
                  <td>{formatMoneyFromCents(lineTotal)}</td>
                  {editable ? (
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => handleMoveRow(idx, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => handleMoveRow(idx, 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className={styles.rowButtonDanger}
                        onClick={() => handleDeleteRow(idx)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!draftItems.length ? (
              <tr>
                <td
                  colSpan={editable ? 5 : 4}
                  className={styles.emptyRow}
                >
                  No line items.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
