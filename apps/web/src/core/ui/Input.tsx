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
        style={{
          boxShadow: "inset 0px 4px 0px 0px var(--input-edge), inset 0px -1px 0px 0px var(--input-highlight)",
        }}
        className={cn(
          "flex w-full rounded-2xl bg-(--color-input) transition-all duration-200 ease-out border border-transparent focus-within:border-(--color-primary)/50 focus-within:ring-4 focus-within:ring-(--color-primary)/20 relative overflow-hidden has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          {
            "h-14": size === "default", // Slightly taller default
            "h-10": size === "sm",
            "h-16": size === "lg",
          },
          error &&
            "border-(--color-destructive)/50 focus-within:border-(--color-destructive) focus-within:ring-4 focus-within:ring-(--color-destructive)/20 bg-(--color-destructive)/5",
          className,
        )}
      >
        <input
          type={type}
          aria-invalid={error ? "true" : "false"}
          className={cn(
            "h-full w-full bg-transparent text-(--color-foreground) outline-none border-none placeholder:text-(--color-muted-foreground) disabled:cursor-not-allowed disabled:opacity-50 font-medium",
            {
              "px-5 py-3 text-sm": size === "default",
              "px-3 py-1 text-xs": size === "sm",
              "px-6 py-4 text-base": size === "lg",
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
