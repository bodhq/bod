import type { ReactNode } from "react";

import { cn } from "@/core/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
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
