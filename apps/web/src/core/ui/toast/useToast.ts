import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick?: () => void | Promise<void>;
  variant?: "default" | "destructive" | "secondary";
}

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  actions?: ToastAction[];
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-3),
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

interface ToastOptions {
  duration?: number;
  actions?: ToastAction[];
}

function show(message: string, variant: ToastVariant, opts?: ToastOptions) {
  // If there are actions and no explicit duration, don't auto-dismiss
  const duration = opts?.duration ?? (opts?.actions ? 0 : 5000);
  return useToastStore.getState().addToast({
    message,
    variant,
    duration,
    actions: opts?.actions?.slice(0, 2),
  });
}

export const toast = {
  default: (message: string, opts?: ToastOptions) => show(message, "default", opts),
  success: (message: string, opts?: ToastOptions) => show(message, "success", opts),
  error: (message: string, opts?: ToastOptions) => show(message, "error", opts),
  info: (message: string, opts?: ToastOptions) => show(message, "info", opts),
  warning: (message: string, opts?: ToastOptions) => show(message, "warning", opts),

  /** Confirmation toast with confirm/cancel buttons */
  confirm: (
    message: string,
    onConfirm: () => void | Promise<void>,
    opts?: {
      variant?: ToastVariant;
      confirmText?: string;
      cancelText?: string;
    },
  ) => {
    const id = show(message, opts?.variant ?? "default", {
      duration: 0,
      actions: [
        {
          label: opts?.cancelText ?? "Zrušit",
          variant: "secondary",
          onClick: () => useToastStore.getState().removeToast(id),
        },
        {
          label: opts?.confirmText ?? "Potvrdit",
          variant: opts?.variant === "error" ? "destructive" : "default",
          onClick: async () => {
            await onConfirm();
            useToastStore.getState().removeToast(id);
          },
        },
      ],
    });
    return id;
  },

  dismiss: (id: string) => useToastStore.getState().removeToast(id),
};
