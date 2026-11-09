"use client";

import type { LucideIcon } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/core/utils";

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
  return (
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
    </nav>
  );
}
