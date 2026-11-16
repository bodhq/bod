import type { ReactNode } from "react";

import { PageBreadcrumbs, PageHeaderActions } from "@/core/ui/navigation/PageBreadcrumbs";
import { cn } from "@/core/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page", className)}>{children}</div>;
}

export function ModuleLayout({
  title,
  description,
  actions,
  navigation,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className="module-layout">
      <PageHeader compact fullWidth title={title} description={description} actions={actions} />
      <Page className={cn("module-layout-content", className)}>
        {navigation && <div className="module-layout-navigation">{navigation}</div>}
        {children}
      </Page>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  compact = true,
  showBreadcrumbs = true,
  showAppActions = true,
  fullWidth = false,
  level = "h1",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  showBreadcrumbs?: boolean;
  showAppActions?: boolean;
  fullWidth?: boolean;
  level?: "h1" | "h2";
}) {
  const Heading = level;
  return (
    <header
      className={cn(
        "page-header",
        compact && "page-header-compact",
        fullWidth && "page-header-fullwidth",
      )}
    >
      <div className="page-header-copy">
        {showBreadcrumbs && <PageBreadcrumbs currentTitle={title} />}
        <Heading className="page-title">{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {(actions || showAppActions) && (
        <div className="page-actions">
          {actions}
          {showAppActions && <PageHeaderActions />}
        </div>
      )}
    </header>
  );
}

export function Section({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ui-section", className)}>
      <header className="section-header">
        <h2>
          {icon && <span aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        {description && <p>{description}</p>}
      </header>
      <div className="section-content">{children}</div>
    </section>
  );
}
