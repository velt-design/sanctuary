"use client";
import { useEffect, useRef } from "react";
import type {
  StudioJoinIntent,
  StudioJoinReadout,
  StudioJoinEdge,
  StudioJoinAlignment,
} from "./studioJoinPresentation";
import css from "./StudioWebsite.module.css";
export default function StudioWebsiteJoinControls({
  view,
  onIntent,
  focused = false,
}: {
  view: StudioJoinReadout;
  onIntent: (intent: StudioJoinIntent) => void;
  focused?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focused) heading.current?.focus({ preventScroll: true });
  }, [focused, view.objectId]);
  const { draft, states, error } = view;
  return (
    <section className={css.joinControls}>
      <>
        {focused && (
          <button
            className={css.quietButton}
            onClick={() => onIntent({ kind: "back" })}
          >
            Back to position
          </button>
        )}
        <h3 ref={heading} tabIndex={-1}>
          Pergola joins
        </h3>
      </>
      {states.map((s) => (
        <div key={s.id}>
          <p>{s.label}</p>
          {s.error && (
            <p role="alert" className={css.fieldError}>
              {s.error}
            </p>
          )}
          <button
            className={css.quietButton}
            disabled={!s.canReposition}
            onClick={() => onIntent({ kind: "reposition", id: s.id })}
          >
            Reposition to join
          </button>
          <button
            className={css.quietButton}
            onClick={() => onIntent({ kind: "remove", id: s.id })}
          >
            Remove join
          </button>
        </div>
      ))}
      {!draft ? (
        <>
          <button
            className={css.quietButton}
            disabled={!view.canStart}
            onClick={() => onIntent({ kind: "start" })}
          >
            Join to pergola
          </button>
          {view.movingAttached && (
            <p>Select a free pergola to move toward this attached pergola.</p>
          )}
        </>
      ) : (
        <>
          <label className={css.field}>
            Moving edge
            <select
              aria-label="Moving pergola edge"
              value={draft.edge}
              onChange={(e) =>
                onIntent({
                  kind: "edge",
                  edge: e.target.value as StudioJoinEdge,
                })
              }
            >
              {["front", "rear", "left", "right"].map((edge) => (
                <option key={edge}>{edge}</option>
              ))}
            </select>
          </label>
          <p>
            Choose a named target edge in Plan. {draft.movingLabel} will move
            when you choose that target. Alignment and edge changes are kept
            immediately.
          </p>
          <label className={css.field}>
            Alignment
            <select
              aria-label="Join alignment"
              value={draft.alignment}
              onChange={(e) =>
                onIntent({
                  kind: "alignment",
                  alignment: e.target.value as StudioJoinAlignment,
                })
              }
            >
              <option value="start">Start</option>
              <option value="centre">Centre</option>
              <option value="end">End</option>
            </select>
          </label>
          {draft.hasTarget && (
            <p>
              {draft.movingLabel} · {draft.edge} → {draft.targetLabel} ·{" "}
              {draft.targetEdge}
            </p>
          )}
          {error && (
            <p role="alert" className={css.fieldError}>
              {error}
            </p>
          )}
          <button
            className={css.quietButton}
            onClick={() => onIntent({ kind: "cancel" })}
          >
            Cancel join
          </button>
        </>
      )}
      {(draft || states.length > 0) && (
        <p>
          Products and stock remain separate. Removing a join keeps their
          positions.
        </p>
      )}
    </section>
  );
}

/** Geometry failures need an authored repair; network failures retain retry. */
export function JoinPriceRecovery({
  invalidLabel,
  onCheck,
  error,
  onRetry,
}: {
  invalidLabel?: string;
  onCheck: () => void;
  error: string | null;
  onRetry: () => void;
}) {
  return invalidLabel ? (
    <button aria-label={`Check join: ${invalidLabel}`} onClick={onCheck}>
      Check join
    </button>
  ) : error ? (
    <button onClick={onRetry}>Retry price</button>
  ) : null;
}
