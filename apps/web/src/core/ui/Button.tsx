import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/core/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
  isPressed?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading,
      isPressed,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-bold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--color-primary)/20 disabled:pointer-events-none disabled:opacity-50",
          !isPressed && "active:translate-y-[4px] active:shadow-none",
          isPressed && "translate-y-[4px] !shadow-none brightness-95",
          {
            "bg-(--color-primary) text-(--color-primary-foreground) shadow-[0_4px_0_0_var(--color-primary-600)] hover:brightness-105":
              variant === "default",
            "bg-(--color-secondary) text-(--color-secondary-foreground) shadow-[0_4px_0_0_oklch(0.85_0.005_250)] dark:shadow-[0_4px_0_0_oklch(0.18_0.015_250)] hover:brightness-95 dark:hover:brightness-110":
              variant === "secondary",
            "border-2 border-(--color-border) text-(--color-foreground) hover:bg-(--color-secondary) shadow-[0_4px_0_0_var(--color-border)] dark:shadow-[0_4px_0_0_oklch(0.18_0.015_250)]":
              variant === "outline",
            "hover:bg-(--color-secondary) text-(--color-foreground)":
              variant === "ghost",
            "bg-(--color-destructive) text-(--color-destructive-foreground) shadow-[0_4px_0_0_oklch(0.40_0.15_20)] hover:brightness-105":
              variant === "destructive",

            "h-12 px-6 py-2 text-base": size === "default",
            "h-10 px-4 text-sm": size === "sm",
            "h-14 px-8 text-lg": size === "lg",
            "h-12 w-12": size === "icon",
          },
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
