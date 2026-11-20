"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "@/core/ui/actions/Button";
import { cn } from "@/core/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  busy = false,
  presentation = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
  presentation?: "dialog" | "drawer";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) {
        dialog.close();
        if (previousFocus instanceof HTMLElement && !previousFocus.isConnected)
          document.getElementById("main-content")?.focus();
      }
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-presentation={presentation}
      style={open ? undefined : { display: "none" }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={(event) => {
        if (event.key === "Tab" || event.key === "Escape") event.stopPropagation();
        if (event.key === "Tab") {
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.matches(":disabled") &&
              element.getClientRects().length > 0,
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (!busy) onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          !busy &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
      className={cn("app-dialog", className)}
    >
      {open && (
        <>
          {presentation === "drawer" ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <div className="dialog-header">
              <h2 id={titleId} className="dialog-title">
                {title}
              </h2>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Zavřít
              </Button>
            </div>
          )}
          {description && (
            <p id={descriptionId} className="dialog-description">
              {description}
            </p>
          )}
          {children}
        </>
      )}
    </dialog>
  );
}
