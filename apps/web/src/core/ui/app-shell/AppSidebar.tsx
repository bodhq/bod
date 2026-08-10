"use client";

import { LayoutDashboard, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from "@/core/auth/components/LogoutButton";
import { Button } from "@/core/ui/Button";
import { Logo } from "@/core/ui/Logo";

const NAV_ITEMS = [{ name: "Přehled", href: "/app", icon: LayoutDashboard }];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden md:flex w-[260px] flex-col bg-transparent border-r border-(--color-border) h-screen p-4 sticky top-0">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Logo className="w-16 h-8" />
      </div>

      <nav className="flex-1 flex flex-col gap-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);

          return (
            <Button
              key={item.name}
              variant={isActive ? "default" : "secondary"}
              onClick={() => router.push(item.href)}
              className="w-full justify-start rounded-2xl h-12 px-4"
            >
              <item.icon
                className="w-5 h-5 mr-3"
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.name}
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-(--color-border)/50">
        <Button
          variant={
            pathname.startsWith("/app/settings") ? "default" : "secondary"
          }
          onClick={() => router.push("/app/settings")}
          className="w-full justify-start rounded-2xl h-12 px-4"
        >
          <Settings
            className="w-5 h-5 mr-3"
            strokeWidth={pathname.startsWith("/app/settings") ? 2.5 : 2}
          />
          Nastavení
        </Button>
        <LogoutButton
          variant="secondary"
          className="w-full justify-start rounded-2xl h-12 px-4 text-(--color-muted-foreground) hover:text-(--color-destructive)"
        >
          Odhlásit se
        </LogoutButton>
      </div>
    </aside>
  );
}
