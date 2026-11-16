"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/core/utils";

import { ResponsiveNavigation } from "./ResponsiveNavigation";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive?: (pathname: string) => boolean;
}
export function NavList({
  items,
  isMinimized = false,
  className,
  ariaLabel,
  onNavigate,
  orientation = "vertical",
}: {
  items: NavItem[];
  isMinimized?: boolean;
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const wrap = (content: ReactNode) =>
    orientation === "horizontal" ? (
      <ResponsiveNavigation
        label={ariaLabel ?? "Agenda"}
        options={items.map((item) => ({ value: item.href, label: item.title }))}
        value={
          items.find((item) => (item.isActive ? item.isActive(pathname) : pathname === item.href))
            ?.href ??
          items[0]?.href ??
          ""
        }
        onChange={(href) => {
          router.push(href);
          onNavigate?.();
        }}
      >
        {content}
      </ResponsiveNavigation>
    ) : (
      content
    );
  return wrap(
    <nav
      aria-label={ariaLabel}
      className={cn("nav-list", className)}
      data-orientation={orientation}
    >
      {items.map(({ title, href, icon: Icon, isActive }) => {
        const active = isActive
          ? isActive(pathname)
          : href === "/app"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={isMinimized ? title : undefined}
            title={isMinimized ? title : undefined}
            data-collapsed={isMinimized}
            className="nav-link"
          >
            <Icon aria-hidden="true" />
            <span className="nav-label min-w-0 truncate" aria-hidden={isMinimized || undefined}>
              {title}
            </span>
          </Link>
        );
      })}
    </nav>,
  );
}
