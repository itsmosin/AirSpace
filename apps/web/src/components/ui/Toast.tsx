"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";
export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  href?: string;
  hrefLabel?: string;
  durationMs?: number;
};

type Ctx = { push: (t: Omit<Toast, "id">) => string; dismiss: (id: string) => void };
const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-green-ink" />,
  error: <AlertTriangle className="size-4 text-red-ink" />,
  info: <Info className="size-4 text-blue-ink" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list.slice(-4), { id, ...t }]);
      const ms = t.durationMs ?? (t.variant === "error" ? 9000 : 6000);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("pointer-events-auto w-full max-w-[380px] rounded-2xl border border-line bg-surface p-4 pr-10 shadow-pop", t.variant === "error" ? "border-red/40" : t.variant === "success" ? "border-green/40" : "")}
              role="status"
            >
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">{icons[t.variant ?? "info"]}</div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-fg">{t.title}</p>
                  {t.description ? <p className="mt-0.5 break-words text-[13px] leading-relaxed text-fg-muted">{t.description}</p> : null}
                  {t.href ? (
                    <a href={t.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-blue-ink hover:underline">
                      {t.hrefLabel ?? "View on explorer"} <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
              <button onClick={() => dismiss(t.id)} className="absolute right-2.5 top-2.5 rounded-full p-1 text-fg-faint hover:bg-fill hover:text-fg" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
