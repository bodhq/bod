import * as React from "react";

import { cn } from "@/core/utils";

import { Label } from "./Label";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  label?: string;
  description?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, label, description, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    const inputContent = (
      <div
        className={cn(
          "input-control relative block h-10 w-full overflow-hidden rounded-[var(--radius)] border border-transparent transition-shadow duration-[180ms] ease-out",
          "bg-[var(--input-edge)] focus-within:ring-2 focus-within:ring-(--color-ring) focus-within:ring-offset-2 ring-offset-(--color-background)",
          error && "border-(--color-destructive) focus-within:ring-(--color-destructive)",
          className,
        )}
      >
        <div className="input-control__face pointer-events-none absolute inset-0 h-full w-full rounded-[var(--radius)] bg-[var(--color-input-face)]" />
        <input
          id={inputId}
          type={type}
          className="input-control__field absolute left-0 top-[var(--input-depth-idle)] h-[calc(100%-var(--input-depth-idle))] w-full bg-transparent px-3 text-sm leading-5 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-(--color-muted-foreground) focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          ref={ref}
          {...props}
        />
      </div>
    );

    if (label || description) {
      return (
        <div className="flex flex-col gap-1.5 w-full">
          {label && (
            <Label htmlFor={inputId} className="text-(--color-foreground)">
              {label}
            </Label>
          )}
          {inputContent}
          {description && (
            <p className="text-[0.8rem] text-(--color-muted-foreground)">{description}</p>
          )}
        </div>
      );
    }
    return inputContent;
  },
);

Input.displayName = "Input";

export { Input };
