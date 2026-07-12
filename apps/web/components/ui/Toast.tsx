"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  ttl?: number;
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  error: <AlertCircle className="h-4 w-4 text-rose-600" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-sky-600" />,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { ...t, id }]);
  }, []);

  const value: ToastContextValue = {
    push,
    success: (title, message) => push({ tone: "success", title, message }),
    error: (title, message) => push({ tone: "error", title, message }),
    info: (title, message) => push({ tone: "info", title, message }),
    warning: (title, message) => push({ tone: "warning", title, message }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const ttl = toast.ttl ?? (toast.tone === "error" ? 8000 : 4000);
    const handle = setTimeout(onDismiss, ttl);
    return () => clearTimeout(handle);
  }, [toast.ttl, toast.tone, onDismiss]);
  return (
    <div
      role="status"
      className={"pointer-events-auto flex items-start gap-3 rounded-md border p-3 shadow-md " + TONE_CLASS[toast.tone]}
    >
      <div className="mt-0.5">{ICONS[toast.tone]}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{toast.title}</div>
        {toast.message && <div className="mt-0.5 text-xs opacity-90">{toast.message}</div>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 text-slate-400 hover:bg-white/40 hover:text-slate-700"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op so tests / previews don't crash
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warning: () => undefined,
      dismiss: () => undefined,
    };
  }
  return ctx;
}
