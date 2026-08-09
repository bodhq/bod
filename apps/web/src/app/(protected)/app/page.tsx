"use client";

import { useAuthStore } from "@/core/auth/store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-10 pb-32 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out px-4 sm:px-8 pt-8">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-(--color-foreground)">
          Dobrý den, {user?.email?.split("@")[0] || "Učiteli"} 👋
        </h1>
        <p className="text-lg font-medium text-(--color-muted-foreground)">
          Vítejte zpět v přehledu.
        </p>
      </header>
    </div>
  );
}
