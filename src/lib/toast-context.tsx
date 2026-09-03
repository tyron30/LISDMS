"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; variant: "success" | "error" };

const ToastContext = createContext<{
  showToast: (message: string, variant?: "success" | "error") => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm shadow-card",
              t.variant === "success"
                ? "border-success/30 bg-surface text-text"
                : "border-critical/30 bg-surface text-text"
            )}
          >
            {t.variant === "success" ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <CircleAlert className="h-4 w-4 shrink-0 text-critical" />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((toasts) => toasts.filter((x) => x.id !== t.id))}
              className="ml-2 text-muted hover:text-text"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
