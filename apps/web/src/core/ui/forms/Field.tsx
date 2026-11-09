import type { ReactNode } from "react";

import { cn } from "@/core/utils";

import { Label } from "./Label";

export interface FieldProps {
  label?: string;
  description?: string;
  error?: boolean | string;
  fieldWidth?: "full" | "standard" | "short";
}

export function fieldDescription(
  id: string,
  description?: string,
  error?: boolean | string,
  external?: string,
) {
  return (
    [external, description && `${id}-description`, typeof error === "string" && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function Field({
  id,
  label,
  description,
  error,
  fieldWidth = "full",
  className,
  children,
}: FieldProps & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("ui-field", className)} data-width={fieldWidth}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      {description && (
        <p id={`${id}-description`} className="field-description">
          {description}
        </p>
      )}
      {typeof error === "string" && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
