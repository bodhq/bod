"use client";

import type { ReactNode } from "react";
import type { ButtonProps } from "@/core/ui/actions/Button";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/core/ui/actions/Button";

/** Shared form and wizard footer. Validation and navigation stay with the caller. */
export function FormActions({
  submitLabel = "Uložit",
  onSubmit,
  onCancel,
  onBack,
  backLabel = "Zpět",
  cancelLabel = "Zrušit",
  pending = false,
  disabled = false,
  backDisabled = false,
  className,
  status,
}: {
  submitLabel?: ButtonProps["children"];
  onSubmit?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  backLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  backDisabled?: boolean;
  className?: string;
  status?: ReactNode;
}) {
  return (
    <div className={`form-actions${className ? ` ${className}` : ""}`}>
      {status && <div className="form-action-status">{status}</div>}
      {onCancel && (
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      {onBack && (
        <Button variant="outline" disabled={pending || backDisabled} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
        </Button>
      )}
      <Button
        type={onSubmit ? "button" : "submit"}
        onClick={onSubmit}
        disabled={disabled}
        isLoading={pending}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
