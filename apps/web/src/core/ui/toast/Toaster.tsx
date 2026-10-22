"use client";

import { AnimatePresence, m } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import * as React from "react";

import { SPRING_SNAPPY, TOAST_VARIANTS, toastAnimate } from "@/core/animations";
import { cn } from "@/core/utils";

import { type ToastAction, type ToastVariant, useToastStore } from "./useToast";

const icons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 shrink-0" />,
  success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
  warning: <AlertCircle className="h-4 w-4 shrink-0" />,
};

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-(--color-surface-100) text-(--color-foreground) border-(--color-border)",
  error: "bg-(--color-destructive) text-(--color-destructive-foreground) border-transparent",
  success: "bg-(--color-success) text-(--color-success-foreground) border-transparent",
  info: "bg-(--color-info) text-(--color-info-foreground) border-transparent",
  warning: "bg-(--color-warning) text-(--color-warning-foreground) border-transparent",
};

function ActionButton({ action, toastId }: { action: ToastAction; toastId: string }) {
  const [loading, setLoading] = React.useState(false);
  const { removeToast } = useToastStore();

  const handleClick = async () => {
    if (action.onClick) {
      setLoading(true);
      try {
        await action.onClick();
      } finally {
        setLoading(false);
      }
    } else {
      removeToast(toastId);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50",
        action.variant === "secondary"
          ? "bg-black/10 hover:bg-black/15"
          : "bg-white/20 hover:bg-white/30",
      )}
    >
      {action.label}
    </button>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
      <div className="relative w-full max-w-sm flex flex-col items-center">
        <AnimatePresence>
          {toasts.map((toast, index) => {
            const stackIndex = toasts.length - 1 - index;

            return (
              <m.div
                key={toast.id}
                initial={TOAST_VARIANTS.initial}
                animate={toastAnimate(stackIndex)}
                exit={TOAST_VARIANTS.exit}
                transition={SPRING_SNAPPY}
                style={{ position: "absolute", top: 0 }}
                className={cn(
                  "pointer-events-auto flex items-center gap-3 w-full rounded-2xl border px-4 py-3",
                  variantStyles[toast.variant],
                )}
              >
                {icons[toast.variant]}
                <span className="text-sm flex-1 min-w-0">{toast.message}</span>

                {toast.actions ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {toast.actions.map((action) => (
                      <ActionButton key={action.label} action={action} toastId={toast.id} />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-current opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                <ToastTimer id={toast.id} duration={toast.duration} />
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastTimer({ id, duration }: { id: string; duration: number }) {
  const removeToast = useToastStore((s) => s.removeToast);

  React.useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => removeToast(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return null;
}
