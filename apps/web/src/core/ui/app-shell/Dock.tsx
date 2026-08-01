"use client";

import { LayoutDashboard, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
      <nav className="pointer-events-auto flex w-full max-w-sm items-center justify-around p-2 sm:p-3 gap-1 rounded-3xl bg-(--color-background)/95 backdrop-blur-xl ring-1 ring-(--color-border) shadow-2xl">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);

          return (
            <Button
              key={item.name}
              variant={isActive ? "default" : "ghost"}
              onClick={() => router.push(item.href)}
              aria-label={item.name}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl h-14 sm:h-16 px-2",
                isActive && "shadow-[0_4px_0_0_var(--color-primary-600)]",
                !isActive && "active:translate-y-[4px]",
              )}
            >
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] sm:text-xs font-semibold">
                {item.name}
              </span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
