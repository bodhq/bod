import * as React from "react";
import { cn } from "@/core/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  error?: boolean;
  size?: "default" | "sm" | "lg";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, size = "default", ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex w-full rounded-xl border border-black/10 dark:border-white/5 bg-(--color-input) shadow-inner shadow-black/10 transition-all duration-300 ease-out focus-within:border-(--color-primary) focus-within:ring-2 focus-within:ring-(--color-primary)/50 relative overflow-hidden has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          {
            "h-12": size === "default",
            "h-10": size === "sm",
            "h-14": size === "lg",
          },
          error &&
            "border-(--color-destructive) focus-within:border-(--color-destructive) focus-within:ring-(--color-destructive)/50",
          className,
        )}
      >
        <input
          type={type}
          aria-invalid={error ? "true" : "false"}
          className={cn(
            "h-full w-full bg-transparent text-(--color-foreground) outline-none border-none placeholder:text-(--color-muted-foreground) disabled:cursor-not-allowed disabled:opacity-50",
            {
              "px-4 py-2 text-sm": size === "default",
              "px-3 py-1 text-xs": size === "sm",
              "px-5 py-3 text-base": size === "lg",
            },
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
