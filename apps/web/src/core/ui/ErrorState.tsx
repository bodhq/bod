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
    <div
      className={cn(
        "p-4 rounded-[var(--radius)] bg-(--color-destructive)/10 text-(--color-destructive) border border-(--color-destructive)/20 flex flex-col items-start gap-2",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 font-bold">
        <AlertCircle size={18} />
        <span>{title}</span>
      </div>
      {Boolean(message || error) && (
        <span className="text-sm font-medium opacity-90">
          {message || (error as Error)?.message || "Neznámá chyba"}
        </span>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
