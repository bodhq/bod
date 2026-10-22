"use client";

import * as React from "react";
import { cn } from "@/core/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onChange, disabled, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      ref={ref}
      onClick={() => onChange(!checked)}
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-(--color-border) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-background) disabled:cursor-not-allowed disabled:opacity-50 sm:h-7 sm:w-12",
        checked ? "bg-(--color-primary)" : "bg-(--color-surface-200)",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 shrink-0 rounded-full border border-black/10 bg-white transition-transform duration-200 ease-out dark:border-white/20 sm:size-5",
          checked ? "translate-x-5 sm:translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  ),
);

Switch.displayName = "Switch";

export { Switch };
