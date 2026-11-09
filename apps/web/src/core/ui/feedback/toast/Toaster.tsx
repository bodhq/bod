"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/core/ui/actions/Button";

import "./toast.css";
import { type Toast, useToastStore } from "./useToast";

const icons = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle,
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);
  const Icon = icons[toast.variant];
  return (
    <div
      className="ui-toast"
      data-variant={toast.variant}
      role={toast.variant === "error" ? "alert" : "status"}
    >
      <Icon size={18} className="toast-icon" aria-hidden="true" />
      <span className="toast-message">{toast.message}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeToast(toast.id)}
        aria-label="Zavřít oznámení"
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <section className="ui-toaster" aria-label="Oznámení">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </section>
  );
}
