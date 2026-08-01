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
          "flex w-full rounded-2xl border-2 border-(--color-border) bg-(--color-input) shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-all duration-300 ease-out focus-within:border-(--color-primary) focus-within:ring-4 focus-within:ring-(--color-primary)/20 relative overflow-hidden has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          {
            "h-12": size === "default",
            "h-10": size === "sm",
            "h-14": size === "lg",
          },
          error &&
            "border-(--color-destructive) focus-within:border-(--color-destructive) focus-within:ring-(--color-destructive)/20",
          className,
        )}
      >
        <input
          type={type}
          aria-invalid={error ? "true" : "false"}
          className={cn(
            "h-full w-full bg-transparent text-(--color-foreground) outline-none border-none placeholder:text-(--color-muted-foreground) disabled:cursor-not-allowed disabled:opacity-50",
            {
              "px-4 py-2 text-base": size === "default",
              "px-3 py-1 text-sm": size === "sm",
              "px-4 py-3 text-lg": size === "lg",
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
