"use client";

import type * as React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/core/utils";

export interface ActionCardProps {
  href?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  rightAction?: React.ReactNode;
}

export function ActionCard({ href, title, description, icon, className, onClick, rightAction }: ActionCardProps) {
  const content = (
    <div
      className={cn(
        "btn-3d-face relative flex w-full items-center justify-between p-4 bg-(--color-surface-100) rounded-[var(--radius)] transition-all duration-150 ease-out transform",
        "-translate-y-[var(--depth-idle)] group-hover/btn:-translate-y-[var(--depth-hover)] group-active/btn:-translate-y-[var(--depth-active)]",
        "border border-[var(--btn-edge)]",
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {icon && <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-[calc(var(--radius)-8px)] bg-(--color-surface-200) text-(--color-foreground)">{icon}</div>}
        <div className="flex flex-col min-w-0">
          <span className="text-sm sm:text-base font-bold text-(--color-foreground) truncate text-left">{title}</span>
          {description && <span className="text-xs font-medium text-(--color-muted-foreground) truncate mt-0.5 text-left">{description}</span>}
        </div>
      </div>
      <div className="flex items-center justify-center shrink-0 ml-3">
        {rightAction || <ChevronRight size={18} strokeWidth={2.5} className="text-(--color-muted-foreground) group-hover/btn:text-(--color-foreground) group-hover/btn:translate-x-0.5 transition-all" />}
      </div>
    </div>
  );
  const containerClasses = cn(
    "btn-3d-wrapper group/btn relative flex flex-col justify-end w-full p-0 border-none rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:ring-offset-2 ring-offset-(--color-background) bg-[var(--edge-secondary)]",
    className,
  );

  if (href) return <Link href={href} className={cn("block outline-none", containerClasses)} tabIndex={0}>{content}</Link>;
  return <button type="button" onClick={onClick} className={cn("text-left", containerClasses)}>{content}</button>;
}
