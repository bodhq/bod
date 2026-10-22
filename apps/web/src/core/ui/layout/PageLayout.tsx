import type { ReactNode } from "react";

import { cn } from "@/core/utils";

export interface PageLayoutProps {
  children: ReactNode;
  variant?: "default" | "dual";
  title?: string;
  subtitle?: string;
  sidebar?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageLayout({
  children,
  variant = "default",
  title,
  subtitle,
  sidebar,
  headerActions,
  className,
  contentClassName,
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8",
        className,
      )}
    >
      {/* Unified Header */}
      {(title || subtitle || headerActions) && (
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && <p className="text-sm text-(--color-muted-foreground) mt-1">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex w-full items-center gap-2 sm:w-auto">{headerActions}</div>}
        </header>
      )}

      {/* Content Area */}
      {variant === "dual" ? (
        <div className="grid flex-1 content-start gap-4 lg:min-h-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          {sidebar && <div className="min-w-0">{sidebar}</div>}
          <div
            className={cn(
              "min-w-0 rounded-2xl border border-(--color-border) bg-(--color-surface-100) p-5 sm:p-7 lg:min-h-[32rem] lg:p-8",
              contentClassName,
            )}
          >
            {children}
          </div>
        </div>
      ) : (
        <div
          className={cn("w-full rounded-2xl border border-(--color-border) bg-(--color-surface-100) p-5 sm:p-7 lg:p-8", contentClassName)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
