"use client";
import { useEffect, useRef, type ReactNode } from "react";
import css from "./StudioWebsite.module.css";
/** Object-tool presentation only. Task/command authority remains in Workspace. */
export default function StudioObjectMenu({
  children,
}: {
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null),
    summary = useRef<HTMLElement>(null);
  const close = (restoreFocus: boolean) => {
    if (menu.current) menu.current.open = false;
    if (restoreFocus) summary.current?.focus();
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        menu.current?.open &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      )
        close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, []);
  return (
    <details
      ref={menu}
      className={css.advancedTools}
      onClickCapture={(event) => {
        const target = event.target as Element;
        // Nested support controls retain their open editing surface.
        if (
          target.closest("button,a") &&
          target.closest("details") === menu.current
        )
          close(true);
      }}
    >
      <summary ref={summary} aria-label="Design tools">
        ⋯
      </summary>
      <div>{children}</div>
    </details>
  );
}
