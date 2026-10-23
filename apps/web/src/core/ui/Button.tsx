"use client";

import { type HTMLMotionProps, m } from "framer-motion";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/core/utils";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "muted"
    | "link"
    | "success"
    | "warning"
    | "info";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
  isPressed?: boolean;
  children?: React.ReactNode;
}

const edgeColors: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "var(--edge-primary)",
  secondary: "var(--edge-secondary)",
  destructive: "var(--edge-destructive)",
  outline: "var(--edge-secondary)",
  ghost: "transparent",
  muted: "transparent",
  link: "transparent",
  success: "var(--edge-success)",
  warning: "var(--edge-warning)",
  info: "var(--edge-info)",
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-(--color-primary) text-(--color-primary-foreground)",
  secondary: "bg-(--color-secondary) text-(--color-secondary-foreground)",
  destructive: "bg-(--color-destructive) text-(--color-destructive-foreground)",
  outline:
    "border border-(--color-border) bg-transparent text-(--color-foreground) hover:bg-(--color-surface-200)",
  ghost: "bg-transparent text-(--color-foreground) hover:bg-(--color-surface-200)",
  muted: "bg-transparent text-(--color-muted-foreground) hover:text-(--color-foreground)",
  link: "bg-transparent text-(--color-primary) underline-offset-4 hover:underline",
  success: "bg-(--color-success) text-white",
  warning: "bg-(--color-warning) text-white",
  info: "bg-(--color-info) text-white",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-8 px-3 py-1.5 text-xs",
  lg: "min-h-12 px-8 py-3 text-base",
  icon: "h-9 w-9 min-h-0 p-0",
};

const motionEase = [0.16, 1, 0.3, 1] as const;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      isPressed,
      disabled,
      children,
      type = "button",
      style,
      ...props
    },
    ref,
  ) => {
    const isFlat = variant === "ghost" || variant === "muted" || variant === "link";

    return (
      <m.button
        ref={ref}
        type={type}
        disabled={isLoading || disabled}
        initial={false}
        animate={isPressed ? "active" : "idle"}
        whileHover="hover"
        whileTap="active"
        style={{ "--btn-edge": edgeColors[variant], ...style } as React.CSSProperties}
        variants={
          isFlat
            ? {
                idle: { scale: 1, transition: { type: "tween", ease: motionEase, duration: 0.38 } },
                hover: {
                  scale: 1.015,
                  transition: { type: "tween", ease: motionEase, duration: 0.3 },
                },
                active: {
                  scale: 0.97,
                  transition: { type: "tween", ease: motionEase, duration: 0.18 },
                },
              }
            : {
                idle: {
                  y: 0,
                  boxShadow:
                    "0px 4px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "tween", ease: motionEase, duration: 0.38 },
                },
                hover: {
                  y: -2,
                  boxShadow:
                    "0px 6px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "tween", ease: motionEase, duration: 0.3 },
                },
                active: {
                  y: 4,
                  boxShadow:
                    "0px 0px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "tween", ease: motionEase, duration: 0.18 },
                },
              }
        }
        className={cn(
          "relative inline-flex min-w-0 max-w-full items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-center font-semibold text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-background)",
          "disabled:pointer-events-none disabled:opacity-50",
          !isFlat && "mb-[5px]",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span className="button-content relative inline-flex min-h-4 w-full min-w-0 items-center justify-center gap-2 text-center">
          {isLoading && <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />}
          {children}
        </span>
      </m.button>
    );
  },
);

Button.displayName = "Button";

export { Button };
