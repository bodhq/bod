"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "lucide-react";
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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => setIsMinimized(!desktop.matches);
    syncSidebar();
    desktop.addEventListener("change", syncSidebar);
    return () => desktop.removeEventListener("change", syncSidebar);
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "bg-(--color-background) px-2 py-4 sm:px-3 sm:py-6 lg:py-8",
        isMinimized ? "w-16 sm:w-[4.5rem]" : "w-56 xl:w-60",
      )}
    >
      <div className="relative mb-6 h-10 w-full overflow-hidden px-1">
        <div
          className={cn(
            "absolute left-0 top-1/2 flex -translate-y-1/2 items-center overflow-hidden transition-[max-width,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]",
            isMinimized
              ? "max-w-0 opacity-0 duration-150"
              : "max-w-[104px] opacity-100 delay-75 duration-[220ms]",
          )}
        >
          <Logo className="h-[18px] w-auto max-w-[104px] shrink-0 text-(--color-foreground)" />
        </div>

        <div
          className={cn(
            "absolute right-10 top-1/2 flex -translate-y-1/2 items-center transition-opacity duration-150 ease-out",
            isMinimized ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <ThemeToggle />
        </div>

        <Button
          variant="muted"
          size="icon"
          onClick={() => setIsMinimized(!isMinimized)}
          className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-(--color-muted-foreground) hover:text-(--color-foreground)"
          aria-label="Přepnout zobrazení panelu"
        >
          <PanelLeftClose
            className={cn(
              "absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-[125ms] ease-out",
              isMinimized ? "opacity-0" : "opacity-100",
            )}
          />
          <PanelLeftOpen
            className={cn(
              "absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-[125ms] ease-out",
              isMinimized ? "opacity-100" : "opacity-0",
            )}
          />
        </Button>
      </div>

      <SidebarNav
        className="min-h-0 flex-1 overflow-y-auto pt-2"
        isMinimized={isMinimized}
        items={NAV_ITEMS.filter((item) => item.name !== "Nastavení").map((item) => ({
          title: item.name,
          href: item.href,
          icon: item.icon,
        }))}
      />

      {user?.permissions?.some((permission) =>
        ["users.manage", "roles.manage", "audit.read"].includes(permission),
      ) && (
        <SidebarNav
          className="mt-3 shrink-0"
          isMinimized={isMinimized}
          items={[{ title: "Správa přístupů", href: "/app/settings/access", icon: ShieldCheck }]}
        />
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-(--color-border) pt-4">
        <Button
          variant={activePath.startsWith("/app/settings") ? "default" : "secondary"}
          onClick={() => navigate("/app/settings")}
          title={isMinimized ? "Nastavení" : undefined}
          className={cn(
            "relative h-10 w-full justify-start overflow-visible px-2 sm:px-3 [&>.button-content]:justify-start [&>.button-content]:gap-0",
          )}
        >
          <Settings
            className={cn(
              "absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-[left,translate] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isMinimized && "left-1/2 -translate-x-1/2",
            )}
            strokeWidth={activePath.startsWith("/app/settings") ? 2.5 : 2}
          />
          <span
            className={cn(
              "min-w-0 truncate transition-[max-width,margin,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isMinimized
                ? "ml-0 max-w-0 opacity-0 duration-150"
                : "ml-[26px] max-w-[150px] opacity-100 delay-100 duration-[220ms]",
            )}
          >
            Nastavení
          </span>
        </Button>

        <LogoutButton
          variant="destructive"
          title={isMinimized ? "Odhlásit se" : undefined}
          className={cn(
            "relative h-10 w-full justify-start overflow-visible px-2 sm:px-3 [&>.button-content]:justify-start [&>.button-content]:gap-0",
          )}
        >
          <LogOut
            className={cn(
              "absolute left-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-[left,translate] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isMinimized && "left-1/2 -translate-x-1/2",
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              "min-w-0 truncate transition-[max-width,margin,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isMinimized
                ? "ml-0 max-w-0 opacity-0 duration-150"
                : "ml-[26px] max-w-[150px] opacity-100 delay-100 duration-[220ms]",
            )}
          >
            Odhlásit se
          </span>
        </LogoutButton>
      </div>
    </aside>
  );
}
