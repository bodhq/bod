"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/core/ui/Button";
import { cn } from "@/core/utils";

import { useNavigationState } from "./useNavigationState";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive?: (activePath: string) => boolean;
}

export interface SidebarNavProps {
  items: NavItem[];
  isMinimized?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SidebarNav({ items, isMinimized = false, className, ariaLabel }: SidebarNavProps) {
  const { activePath, navigate } = useNavigationState();

  return (
    <nav className={cn("flex flex-col gap-3", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        // If isActive function is provided, use it. Otherwise use exact match for root /app or startsWith
        const active = item.isActive
          ? item.isActive(activePath)
          : item.href === "/app"
            ? activePath === "/app"
            : activePath.startsWith(item.href);

        return (
          <Button
            key={item.href}
            variant={active ? "default" : "secondary"}
            onClick={() => navigate(item.href)}
            title={isMinimized ? item.title : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative h-10 w-full justify-start overflow-visible px-2 sm:px-3 [&>.button-content]:justify-start [&>.button-content]:gap-0",
            )}
          >
            <item.icon
              className={cn(
                "absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-[left,translate] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isMinimized && "left-1/2 -translate-x-1/2",
              )}
              strokeWidth={active ? 2.5 : 2}
            />
            <span
              className={cn(
                "min-w-0 truncate transition-[max-width,margin,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isMinimized
                  ? "ml-0 max-w-0 opacity-0 duration-150"
                  : "ml-[26px] max-w-[150px] opacity-100 delay-100 duration-[220ms]",
              )}
            >
              {item.title}
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
