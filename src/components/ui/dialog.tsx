"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Keep the latest onClose in a ref instead of an effect dependency.
  // onClose is typically a fresh inline function every render (e.g.
  // `onClose={() => setOpen(false)}`), so depending on it directly made
  // the effect below re-run on every keystroke inside the dialog — which
  // re-focused an element and effectively stole focus away from whatever
  // the person was typing in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Keyboard handling: Escape closes, Tab is trapped inside the dialog so
  // keyboard users (and screen reader users) can't tab into the page
  // underneath while a modal is open. This only runs when `open` actually
  // changes, not on every render.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", onKey);
      // Focus the first field inside the dialog's *content* (not the
      // header's X button, which would otherwise win since it's earlier
      // in the DOM) once the dialog has actually rendered — and only
      // once, when it opens.
      const t = setTimeout(() => {
        const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }, 0);
      return () => {
        document.removeEventListener("keydown", onKey);
        clearTimeout(t);
      };
    }
  }, [open]);

  // Return focus to whatever triggered the dialog once it closes, so
  // keyboard users don't lose their place in the page.
  useEffect(() => {
    if (!open && previouslyFocused.current) {
      previouslyFocused.current.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 w-full max-w-md rounded-t-md border border-border bg-surface shadow-card sm:rounded-md",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={contentRef} className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
