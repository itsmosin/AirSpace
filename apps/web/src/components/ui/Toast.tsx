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
  success: <CheckCircle2 className="size-4 text-emerald" />,
  error: <AlertTriangle className="size-4 text-rose" />,
  info: <Info className="size-4 text-cyan" />,
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
              className={cn("pointer-events-auto w-full max-w-[380px] rounded-xl glass-strong p-3.5 pr-10 shadow-2xl", t.variant === "error" ? "border-rose/30" : t.variant === "success" ? "border-emerald/30" : "")}
              role="status"
            >
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">{icons[t.variant ?? "info"]}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{t.title}</p>
                  {t.description ? <p className="mt-0.5 break-words text-xs leading-relaxed text-fg-muted">{t.description}</p> : null}
                  {t.href ? (
                    <a href={t.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">
                      {t.hrefLabel ?? "View on explorer"} <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
              <button onClick={() => dismiss(t.id)} className="absolute right-2.5 top-2.5 rounded-md p-1 text-fg-faint hover:bg-white/10 hover:text-fg" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
