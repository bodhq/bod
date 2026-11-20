"use client";

import type { ReactNode } from "react";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAppearanceStore } from "@/core/appearance/preferences";
import { ThemeToggle } from "@/core/appearance/ThemeToggle";
import { Button } from "@/core/ui/actions/Button";
import { BreadcrumbsProvider } from "@/core/ui/navigation/PageBreadcrumbs";
import { Dialog } from "@/core/ui/overlays/Dialog";

import { AppSidebar } from "./AppSidebar";
import { type BreadcrumbItem, pageBreadcrumbs } from "./navigation";

export function AppShell({
  children,
  breadcrumbs = [],
}: {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  const pathname = usePathname();
  const trail = [...pageBreadcrumbs(pathname), ...breadcrumbs];
  const collapsed = useAppearanceStore((state) => state.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  return (
    <BreadcrumbsProvider
      items={trail}
      actions={
        <>
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
          <ThemeToggle />
        </>
      }
    >
      <div className="app-shell" data-sidebar-collapsed={collapsed}>
        <a href="#main-content" className="skip-link">
          Přejít k obsahu
        </a>
        <AppSidebar />
        <div className="app-shell-content">
          <main id="main-content" tabIndex={-1} className="app-main">
            {children}
          </main>
        </div>
        <Dialog
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          title="Navigace"
          className="mobile-navigation"
          presentation="drawer"
        >
          <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
        </Dialog>
      </div>
    </BreadcrumbsProvider>
  );
}
