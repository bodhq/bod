"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

import { forwardRef, useId } from "react";

import { cn } from "@/core/utils";

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode }
>(function Checkbox({ id, label, className, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const input = (
    <input
      {...props}
      id={inputId}
      ref={ref}
      type="checkbox"
      className={cn("ui-checkbox", className)}
    />
  );
  return label ? (
    <label htmlFor={inputId} className="checkbox-field">
      {input}
      <span>{label}</span>
    </label>
  ) : (
    input
  );
});
