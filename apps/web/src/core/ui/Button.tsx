"use client";

import { type HTMLMotionProps, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/core/utils";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
  isPressed?: boolean;
}

const edgeColors: Record<string, string> = {
  default: "var(--edge-primary)",
  secondary: "var(--edge-secondary)",
  outline: "var(--edge-outline)",
  ghost: "transparent",
  destructive: "var(--edge-destructive)",
};

const _smooth = [0.16, 1, 0.3, 1];

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
      style,
      ...props
    },
    ref,
  ) => {
    const isFlat = variant === "ghost";

    return (
      <motion.button
        ref={ref}
        disabled={isLoading || disabled}
        initial={false}
        animate={isPressed ? "active" : "idle"}
        whileHover="hover"
        whileTap="active"
        style={
          {
            "--btn-edge": edgeColors[variant],
            ...style,
          } as React.CSSProperties
        }
        variants={
          isFlat
            ? {
                idle: {
                  scale: 1,
                  transition: { type: "spring", bounce: 0, duration: 0.4 },
                },
                hover: {
                  scale: 1.02,
                  transition: { type: "spring", bounce: 0, duration: 0.3 },
                },
                active: {
                  scale: 0.96,
                  transition: { type: "spring", bounce: 0, duration: 0.15 },
                },
              }
            : {
                idle: {
                  y: 0,
                  boxShadow: "0px 4px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "spring", bounce: 0, duration: 0.4 },
                },
                hover: {
                  y: -2,
                  boxShadow: "0px 6px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "spring", bounce: 0, duration: 0.3 },
                },
                active: {
                  y: 4,
                  boxShadow: "0px 0px 0px 0px var(--btn-edge), inset 0px 1px 0px 0px var(--btn-highlight)",
                  transition: { type: "spring", bounce: 0, duration: 0.15 },
                },
              }
        }
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-bold text-sm tracking-wide",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-(--color-primary)/50",
          "disabled:pointer-events-none disabled:opacity-50",
          !isFlat && "mb-[5px]", // Reserve space for the shadow
          {
            "bg-(--color-primary) text-(--color-primary-foreground)":
              variant === "default",
            "bg-(--color-secondary) text-(--color-secondary-foreground)":
              variant === "secondary",
            "border border-(--color-border) bg-transparent":
              variant === "outline",
            "text-(--color-foreground)": variant === "ghost",
            "bg-(--color-destructive) text-(--color-destructive-foreground)":
              variant === "destructive",

            "h-12 px-6": size === "default",
            "h-10 px-4 text-[10px]": size === "sm",
            "h-14 px-8 text-sm": size === "lg",
            "h-12 w-12": size === "icon",
          },
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children as any}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button };
