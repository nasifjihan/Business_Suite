"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItemData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

type ToastListener = (toast: ToastItemData) => void;

const listeners = new Set<ToastListener>();

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function push(type: ToastType, title: string, description?: string) {
  const toast: ToastItemData = {
    id: generateId(),
    type,
    title,
    description,
    duration: 4000,
  };
  listeners.forEach((l) => l(toast));
}

export const toast = {
  success(title: string, description?: string) {
    push("success", title, description);
  },
  error(title: string, description?: string) {
    push("error", title, description);
  },
  info(title: string, description?: string) {
    push("info", title, description);
  },
};

const VARIANT_CLASSES: Record<ToastType, string> = {
  success:
    "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200",
  error:
    "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200",
  info:
    "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-200",
};

const CLOSE_CLASSES: Record<ToastType, string> = {
  success:
    "text-emerald-500 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-100",
  error:
    "text-rose-500 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-100",
  info:
    "text-sky-500 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-100",
};

export function GlobalToast() {
  const [toasts, setToasts] = React.useState<ToastItemData[]>([]);

  React.useEffect(() => {
    const listener: ToastListener = (t) => {
      setToasts((prev) => [...prev, t]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitives.Root
          key={t.id}
          duration={t.duration}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id);
          }}
          className={cn(
            "group pointer-events-auto relative flex w-full max-w-sm items-start justify-between gap-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
            VARIANT_CLASSES[t.type]
          )}
        >
          <div className="grid gap-1 flex-1">
            <ToastPrimitives.Title className="text-sm font-semibold leading-none">
              {t.title}
            </ToastPrimitives.Title>
            {t.description && (
              <ToastPrimitives.Description className="text-sm opacity-90 leading-snug">
                {t.description}
              </ToastPrimitives.Description>
            )}
          </div>
          <ToastPrimitives.Close
            className={cn(
              "absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2",
              CLOSE_CLASSES[t.type]
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </ToastPrimitives.Close>
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
    </ToastPrimitives.Provider>
  );
}
