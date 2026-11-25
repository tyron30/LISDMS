"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { LEYTE_TOWNS, LeyteTown } from "@/lib/leyte-towns";
import { cn } from "@/lib/utils";

// Free-text input with suggestions (not a locked dropdown — "Province of
// Leyte" and other non-town rows still need to be typeable). Picking a
// suggestion also reports its known district back to the caller so the
// form can auto-fill that field.
export function LguNameAutocomplete({
  value,
  onChange,
  onSelectTown,
  exclude = [],
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectTown: (town: LeyteTown) => void;
  exclude?: string[]; // names to leave out of the suggestions (already in the system)
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const matches =
    query.length === 0
      ? []
      : LEYTE_TOWNS.filter((t) => t.name.toLowerCase().includes(query) && !exclude.includes(t.name)).slice(0, 8);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(town: (typeof LEYTE_TOWNS)[number]) {
    onChange(town.name);
    onSelectTown(town);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && matches[activeIndex]) {
      e.preventDefault();
      select(matches[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing an LGU name..."
        required
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-card">
          {matches.map((t, i) => (
            <button
              key={t.name}
              type="button"
              onClick={() => select(t)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                i === activeIndex ? "bg-bg" : ""
              )}
            >
              <span className="text-text">{t.name}</span>
              {t.district && <span className="text-xs text-muted">{t.district}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
