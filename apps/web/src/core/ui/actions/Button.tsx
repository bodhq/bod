"use client";

import type { ButtonHTMLAttributes } from "react";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/core/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "muted"
    | "choice"
    | "link"
    | "success"
    | "warning"
    | "info";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
  isPressed?: boolean;
  contentClassName?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "default",
    isLoading = false,
    isPressed,
    disabled,
    className,
    contentClassName,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const raised = variant === "default" || variant === "destructive";
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      aria-pressed={props["aria-pressed"] ?? isPressed}
      data-variant={variant}
      data-size={size}
      data-depth={raised ? "raised" : "flat"}
      className={cn("ui-button", className)}
    >
      <span className={cn("button-content", contentClassName)}>
        {isLoading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
        {children}
      </span>
    </button>
  );
});
