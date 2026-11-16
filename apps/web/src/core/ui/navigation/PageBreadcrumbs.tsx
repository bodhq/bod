"use client";

import type { ReactNode } from "react";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { createContext, Fragment, useContext } from "react";

export interface PageBreadcrumbItem {
  title: string;
  href?: string;
}

const PageHeaderContext = createContext<{
  breadcrumbs: PageBreadcrumbItem[];
  actions: ReactNode;
}>({ breadcrumbs: [], actions: null });

export function BreadcrumbsProvider({
  items,
  actions,
  children,
}: {
  items: PageBreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageHeaderContext.Provider value={{ breadcrumbs: items, actions: actions ?? null }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function PageBreadcrumbs({ currentTitle }: { currentTitle: string }) {
  const { breadcrumbs: items } = useContext(PageHeaderContext);
  const hasCurrentCrumb = items.at(-1)?.title !== currentTitle;
  const trail = hasCurrentCrumb ? items : items.slice(0, -1);
  if (!trail.length) return null;

  return (
    <nav aria-label="Drobečková navigace" className="page-breadcrumb">
      {trail.map((item, index) => (
        <Fragment key={JSON.stringify([item.href, item.title])}>
          {index > 0 && (
            <ChevronRight className="breadcrumb-separator" size={12} aria-hidden="true" />
          )}
          {hasCurrentCrumb && index === trail.length - 1 ? (
            <span aria-current="page">{item.title}</span>
          ) : item.href ? (
            <Link href={item.href}>{item.title}</Link>
          ) : (
            <span>{item.title}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function PageHeaderActions() {
  return useContext(PageHeaderContext).actions;
}
