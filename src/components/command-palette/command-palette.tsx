"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Ticket as TicketIcon, CalendarDays, FileText, CornerDownLeft } from "lucide-react";
import { useCommandPalette } from "@/lib/command-palette-context";
import { searchAll, CommandResult } from "@/lib/command-search";

const CATEGORY_ICON: Record<CommandResult["category"], typeof Building2> = {
  LGU: Building2,
  Ticket: TicketIcon,
  Schedule: CalendarDays,
  Requirement: FileText,
};

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const r = await searchAll(q);
      setResults(r);
      setActiveIndex(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

  function navigateTo(result: CommandResult) {
    setOpen(false);
    router.push(result.href ?? `/lgus/${result.lguId}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-20 sm:pt-24">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search LGUs, tickets, schedules, requirements..."
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {!query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-muted">Start typing to search…</p>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">No results for &quot;{query}&quot;</p>
          )}
          {results.map((r, i) => {
            const Icon = CATEGORY_ICON[r.category];
            return (
              <button
                key={`${r.category}-${r.id}`}
                onClick={() => navigateTo(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                  i === activeIndex ? "bg-bg" : ""
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{r.primary}</p>
                  <p className="truncate text-xs text-muted">{r.secondary}</p>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">{r.category}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted sm:flex">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> to select
          </span>
          <span>↑↓ to navigate</span>
        </div>
      </div>
    </div>
  );
}
