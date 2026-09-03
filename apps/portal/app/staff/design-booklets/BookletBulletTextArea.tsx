import { useLayoutEffect, useRef, useState } from "react";
import {
  continueDesignBookletBullet,
  designBookletBulletItem,
  toggleDesignBookletBullets,
  type DesignBookletTextSelection,
} from "@/lib/designBooklets/editorialText";
import styles from "./designBooklets.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  rows: number;
  placeholder?: string;
  onChange: (value: string) => void;
};

function selectedLinesHaveBullets(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const nextBreak = value.indexOf("\n", effectiveEnd);
  const end = nextBreak === -1 ? value.length : nextBreak;
  const lines = value
    .slice(start, end)
    .split("\n")
    .filter((line) => line.trim());
  return (
    lines.length > 0 &&
    lines.every((line) => designBookletBulletItem(line) !== null)
  );
}

export default function BookletBulletTextArea({
  id,
  label,
  value,
  maxLength,
  rows,
  placeholder,
  onChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<DesignBookletTextSelection | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea || pending.value !== value) return;
    pendingSelection.current = null;
    textarea.focus();
    textarea.setSelectionRange(pending.selectionStart, pending.selectionEnd);
  }, [value]);

  function syncSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }

  function apply(next: DesignBookletTextSelection) {
    pendingSelection.current = next;
    setSelection({
      start: next.selectionStart,
      end: next.selectionEnd,
    });
    if (next.value === value && textareaRef.current) {
      pendingSelection.current = null;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        next.selectionStart,
        next.selectionEnd,
      );
    }
    onChange(next.value);
  }

  return (
    <div className={styles.field}>
      <div className={styles.textareaToolbar}>
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          aria-label={`Toggle bullets in ${label}`}
          aria-pressed={selectedLinesHaveBullets(
            value,
            selection.start,
            selection.end,
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            apply(
              toggleDesignBookletBullets(
                value,
                textarea.selectionStart,
                textarea.selectionEnd,
                maxLength,
              ),
            );
          }}
        >
          <span aria-hidden="true">\u2022</span>
          Bullets
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onSelect={syncSelection}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.nativeEvent.isComposing
          ) {
            return;
          }
          const textarea = event.currentTarget;
          const next = continueDesignBookletBullet(
            value,
            textarea.selectionStart,
            textarea.selectionEnd,
            maxLength,
          );
          if (!next) return;
          event.preventDefault();
          apply(next);
        }}
      />
    </div>
  );
}
