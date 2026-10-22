import type * as React from "react";

import { cn } from "@/core/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-[var(--radius)] bg-(--color-surface-200)/50 border border-(--color-border) border-dashed text-center min-h-40",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="text-4xl mb-4 opacity-50 flex items-center justify-center">{icon}</div>
      )}
      <h3 className="text-h3 mb-1">{title}</h3>
      {description && <p className="text-muted text-sm font-medium max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
