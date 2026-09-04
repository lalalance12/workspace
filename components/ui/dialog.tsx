"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * A modal, on the browser's own <dialog>.
 *
 * Radix is here for the popover, and the comment on that file says why: it
 * supplies the behaviour that is genuinely hard. For a modal, that argument no
 * longer holds — showModal() gives focus trapping, Escape, the top layer, an
 * inert background and a real ::backdrop for nothing, in every browser this app
 * supports. Pulling in a dialog package to reimplement all of it would add a
 * dependency to lose features.
 *
 * What it does NOT give, and what is handled below:
 *   - Escape closing the element without telling React. The close event syncs.
 *   - Backdrop clicks. They land on the <dialog> itself, so the check is that
 *     the target IS the dialog — which is why the padding lives on the inner
 *     div and never on the element itself. Padding on the dialog would be
 *     backdrop as far as this test is concerned, and clicking just inside the
 *     panel's edge would dismiss it.
 *   - Background scroll, which the top layer does not prevent.
 */
export function Dialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for screen readers. */
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // showModal() on an already-open dialog throws, and close() on a closed one
    // fires a spurious close event. Guard both.
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Fires for Escape and for form method="dialog" as well as our own
      // close(), so this is the single place open state gets handed back.
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="dialog"
    >
      {/* Only mounted while open, so the content is not in the accessibility
          tree of a closed dialog and every open starts from a clean state. */}
      {open && <div className="dialog-body">{children}</div>}
    </dialog>
  );
}
