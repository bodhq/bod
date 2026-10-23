"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/core/ui/Button";
import { cn } from "@/core/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn("h-9 w-9", className)} />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="muted"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Přepnout motiv"
      className={className}
    >
      {isDark ? (
        <Moon className="h-[1.1rem] w-[1.1rem]" />
      ) : (
        <Sun className="h-[1.1rem] w-[1.1rem]" />
      )}
    </Button>
  );
}
