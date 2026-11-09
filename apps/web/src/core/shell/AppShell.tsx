"use client";

import type { ReactNode } from "react";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAppearanceStore } from "@/core/appearance/preferences";
import { ThemeToggle } from "@/core/appearance/ThemeToggle";
import { Button } from "@/core/ui/actions/Button";
import { Dialog } from "@/core/ui/overlays/Dialog";

import { AppSidebar } from "./AppSidebar";
import { pageNames } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const collapsed = useAppearanceStore((state) => state.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell" data-sidebar-collapsed={collapsed}>
      <a href="#main-content" className="skip-link">
        Přejít k obsahu
      </a>
      <AppSidebar />
      <div className="app-shell-content">
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="Otevřít navigaci"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <nav aria-label="Drobečková navigace" className="app-breadcrumb">
              <Link href="/app">Pracovní prostor</Link>
              <ChevronRight className="breadcrumb-separator" size={14} aria-hidden="true" />
              <span>{pageNames[pathname] ?? "bod"}</span>
            </nav>
          </div>
          <ThemeToggle />
        </header>
        <main id="main-content" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
      <Dialog
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Navigace"
        className="mobile-navigation"
      >
        <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
      </Dialog>
    </div>
  );
}
