"use client";

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/core/auth/components/LogoutButton";
import { useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/Button";
import { Logo } from "@/core/ui/Logo";
import { ThemeToggle } from "@/core/ui/ThemeToggle";
import { cn } from "@/core/utils";

import { NAV_ITEMS } from "./config";
import { SidebarNav } from "./SidebarNav";
import { useNavigationState } from "./useNavigationState";

export function AppSidebar() {
  const user = useAuthUser();
  const { activePath, navigate } = useNavigationState();
  const [isMinimized, setIsMinimized] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => {
      setIsDesktop(desktop.matches);
      setIsMinimized(!desktop.matches);
      if (desktop.matches) setIsMobileOpen(false);
    };
    syncSidebar();
    desktop.addEventListener("change", syncSidebar);
    return () => desktop.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    if (!isMobileOpen || isDesktop) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDesktop, isMobileOpen]);

  const compact = isDesktop ? isMinimized : !isMobileOpen;
  const closeMobileMenu = () => setIsMobileOpen(false);

  return (
    <>
      {!isDesktop && !isMobileOpen && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(true)}
          className="fixed bottom-4 left-4 z-40 h-10 w-10 rounded-xl bg-(--color-background) lg:hidden"
          aria-label="Otevřít navigaci"
          aria-expanded={false}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      {!isDesktop && isMobileOpen && (
        <button
          type="button"
          aria-label="Zavřít navigaci"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
        />
      )}
      <aside
        aria-label="Hlavní navigace"
        aria-hidden={!isDesktop && !isMobileOpen}
        inert={!isDesktop && !isMobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,84vw)] flex-col overflow-hidden bg-(--color-background) px-3 py-6 transition-[transform,width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "lg:static lg:z-20 lg:h-dvh lg:shrink-0 lg:self-stretch lg:translate-x-0 lg:overflow-hidden lg:px-2 lg:py-8 xl:px-3",
          isDesktop
            ? "translate-x-0"
            : isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          compact ? "lg:w-[4.5rem] xl:w-[4.5rem]" : "lg:w-56 xl:w-60",
        )}
      >
        <div className="relative mb-6 h-10 w-full overflow-hidden px-1">
          <div
            className={cn(
              "absolute left-0 top-1/2 flex -translate-y-1/2 items-center overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              compact ? "max-w-0 opacity-0" : "max-w-[104px] opacity-100 delay-75",
            )}
          >
            <Logo className="h-[18px] w-auto max-w-[104px] shrink-0 text-(--color-foreground)" />
          </div>

          <div
            className={cn(
              "absolute right-10 top-1/2 flex -translate-y-1/2 items-center transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              compact ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <ThemeToggle />
          </div>

          <Button
            variant="muted"
            size="icon"
            onClick={() => {
              if (isDesktop) setIsMinimized(!isMinimized);
              else closeMobileMenu();
            }}
            className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-(--color-muted-foreground) transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-(--color-foreground)"
            aria-label={isDesktop ? "Přepnout zobrazení panelu" : "Zavřít navigaci"}
          >
            <PanelLeftClose
              className={cn(
                "absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact ? "opacity-0" : "opacity-100",
              )}
            />
            <PanelLeftOpen
              className={cn(
                "absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact ? "opacity-100" : "opacity-0",
              )}
            />
          </Button>
        </div>

        <SidebarNav
          className="min-h-0 flex-1 overflow-y-auto pt-2"
          isMinimized={compact}
          onNavigate={closeMobileMenu}
          items={
            user?.must_change_password
              ? []
              : NAV_ITEMS.filter((item) => item.name !== "Nastavení").map((item) => ({
                  title: item.name,
                  href: item.href,
                  icon: item.icon,
                }))
          }
        />

        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-(--color-border) pt-4">
          <Button
            variant={activePath.startsWith("/app/settings") ? "default" : "secondary"}
            onClick={() => {
              navigate("/app/settings");
              closeMobileMenu();
            }}
            title={compact ? "Nastavení" : undefined}
            className={cn(
              "relative h-10 w-full justify-start overflow-visible px-2 transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-3 [&>.button-content]:justify-start [&>.button-content]:gap-0",
            )}
          >
            <Settings
              className={cn(
                "absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-[left,translate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact && "left-1/2 -translate-x-1/2",
              )}
              strokeWidth={activePath.startsWith("/app/settings") ? 2.5 : 2}
            />
            <span
              className={cn(
                "min-w-0 truncate transition-[max-width,margin,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact ? "ml-0 max-w-0 opacity-0" : "ml-[26px] max-w-[150px] opacity-100 delay-75",
              )}
            >
              Nastavení
            </span>
          </Button>

          <LogoutButton
            variant="destructive"
            title={compact ? "Odhlásit se" : undefined}
            onClick={closeMobileMenu}
            className={cn(
              "relative h-10 w-full justify-start overflow-visible px-2 transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-3 [&>.button-content]:justify-start [&>.button-content]:gap-0",
            )}
          >
            <LogOut
              className={cn(
                "absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-[left,translate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact && "left-1/2 -translate-x-1/2",
              )}
              strokeWidth={2}
            />
            <span
              className={cn(
                "min-w-0 truncate transition-[max-width,margin,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                compact ? "ml-0 max-w-0 opacity-0" : "ml-[26px] max-w-[150px] opacity-100 delay-75",
              )}
            >
              Odhlásit se
            </span>
          </LogoutButton>
        </div>
      </aside>
    </>
  );
}
