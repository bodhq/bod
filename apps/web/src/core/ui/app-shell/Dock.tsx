"use client";

import { LayoutDashboard, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from "@/core/auth/components/LogoutButton";
import { Button } from "@/core/ui/Button";
import { cn } from "@/core/utils";

const NAV_ITEMS = [
  { name: "Přehled", href: "/app", icon: LayoutDashboard },
  { name: "Nastavení", href: "/app/settings", icon: Settings },
];

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[max(env(safe-area-inset-bottom),1rem)] px-4">
      {/* Sloučená mobilní navigační pilulka */}
      <nav className="pointer-events-auto flex w-full max-w-sm items-center justify-around p-2 sm:p-3 gap-1 rounded-3xl bg-(--color-surface-100)/95 backdrop-blur-xl ring-1 ring-(--color-border) shadow-2xl">
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
              aria-label={item.name}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl h-14 sm:h-16 px-2",
              )}
            >
              <item.icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] sm:text-xs font-semibold">
                {item.name}
              </span>
            </Button>
          );
        })}
        
        {/* Odhlášení na mobilu */}
        <LogoutButton
          variant="secondary"
          className="flex flex-col items-center justify-center gap-1 rounded-2xl h-14 sm:h-16 px-4 ml-1 shrink-0 text-(--color-muted-foreground) hover:text-(--color-destructive)"
          aria-label="Odhlásit se"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        </LogoutButton>
      </nav>
    </div>
  );
}
