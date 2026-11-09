import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
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
}

function show(message: string, variant: ToastVariant, opts?: ToastOptions) {
  const duration = opts?.duration ?? 5000;
  return useToastStore.getState().addToast({
    message,
    variant,
    duration,
  });
}

export const toast = {
  default: (message: string, opts?: ToastOptions) => show(message, "default", opts),
  success: (message: string, opts?: ToastOptions) => show(message, "success", opts),
  error: (message: string, opts?: ToastOptions) => show(message, "error", opts),
  info: (message: string, opts?: ToastOptions) => show(message, "info", opts),
  warning: (message: string, opts?: ToastOptions) => show(message, "warning", opts),

  dismiss: (id: string) => useToastStore.getState().removeToast(id),
};
