import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/core/utils";

export function Panel({
  as: Element = "section",
  padded = true,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  as?: "section" | "article" | "aside" | "div" | "li" | "details";
  padded?: boolean;
}) {
  return (
    <Element {...props} data-padded={padded} className={cn("ui-panel", className)}>
      {children}
    </Element>
  );
}

export function PanelHeader({
  title,
  description,
  eyebrow,
  actions,
  level: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  level?: "h2" | "h3";
}) {
  return (
    <header className="panel-header">
      <div className="min-w-0">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <Heading>{title}</Heading>
        {description && <p className="panel-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
