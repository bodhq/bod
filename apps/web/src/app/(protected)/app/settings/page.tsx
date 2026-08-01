"use client";

import { useAuthStore } from "@/core/auth/store";

export default function SettingsPage() {
  const _user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-10 pb-32 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out px-4 sm:px-8 pt-8">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-(--color-foreground)">
          Nastavení
        </h1>
        <p className="text-lg font-medium text-(--color-muted-foreground)">
          Spravujte svůj účet a předvolby aplikace.
        </p>
      </header>

      {/* Content */}
      <div className="bg-(--color-surface)/60 backdrop-blur-xl ring-1 ring-(--color-border) shadow-lg rounded-[2rem] p-8">
        <p className="text-(--color-muted-foreground)">
          Nastavení bude k dispozici v budoucí verzi.
        </p>
      </div>
    </div>
  );
}
