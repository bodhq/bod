import type * as React from "react";

import { AlertCircle } from "lucide-react";

import { cn } from "@/core/utils";

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  error?: Error | unknown;
  message?: React.ReactNode;
  action?: React.ReactNode;
}

export function ErrorState({
  title = "Nastala chyba",
  error,
  message,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("ui-error", className)} {...props}>
      <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {Boolean(message || error) && (
          <p>{message || (error instanceof Error ? error.message : "Neznámá chyba")}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
