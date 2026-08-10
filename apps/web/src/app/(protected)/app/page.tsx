"use client";

import { m } from "framer-motion";
import { useAuthStore } from "@/core/auth/store";
import { Button } from "@/core/ui/Button";
import { Text } from "@/core/ui/Text";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.6 }}
      className="flex flex-col gap-10 pb-32 max-w-5xl mx-auto px-4 sm:px-8 pt-8"
    >
      <div className="flex flex-col gap-8">
        {/* Apple-style Welcome Header */}
        <header className="flex flex-col gap-1">
          <Text variant="h1">
            Dobrý den, {user?.username || "Učiteli"}
          </Text>
          <Text variant="muted-lg">
            Vítejte zpět. Zde je váš přehled na dnešní den.
          </Text>
        </header>

        {/* Premium Login-style Card */}
        <div className="w-full rounded-3xl sm:rounded-[2rem] bg-(--color-surface-100) p-6 sm:p-10 shadow-xl shadow-black/5 dark:shadow-black/20 border border-black/10 dark:border-white/10 relative overflow-hidden">
          <Text variant="h2" className="mb-6">Rychlé akce</Text>
          
          {/* Apple-style grid: cleaner, less noisy, more focused */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Card 1 */}
            <div className="flex flex-col p-5 sm:p-6 rounded-2xl bg-(--color-surface-200) border border-(--color-border-subtle) hover:border-(--color-border-strong) transition-colors">
               <div className="w-12 h-12 bg-(--color-primary)/20 rounded-2xl flex items-center justify-center mb-4 text-h2 shadow-sm shrink-0">
                 📚
               </div>
               <Text variant="h3" className="mb-1">Nová lekce</Text>
               <Text variant="muted" className="mb-6 flex-1">Rychle vytvořte a naplánujte novou hodinu.</Text>
               <Button variant="default" className="w-full shadow-sm">
                 Vytvořit
               </Button>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col p-5 sm:p-6 rounded-2xl bg-(--color-surface-200) border border-(--color-border-subtle) hover:border-(--color-border-strong) transition-colors">
               <div className="w-12 h-12 bg-(--color-secondary) ring-1 ring-black/5 dark:ring-white/5 rounded-2xl flex items-center justify-center mb-4 text-h2 shadow-sm shrink-0">
                 📅
               </div>
               <Text variant="h3" className="mb-1">Rozvrh</Text>
               <Text variant="muted" className="mb-6 flex-1">Prohlédněte si, co vás dnes čeká.</Text>
               <Button variant="secondary" className="w-full">
                 Otevřít
               </Button>
            </div>

            {/* Card 3 */}
            <div className="flex flex-col p-5 sm:p-6 rounded-2xl bg-(--color-surface-200) border border-(--color-border-subtle) hover:border-(--color-border-strong) transition-colors">
               <div className="w-12 h-12 bg-(--color-surface-100) ring-1 ring-black/5 dark:ring-white/5 rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold tracking-tight shadow-sm shrink-0">
                 ⚙️
               </div>
               <Text variant="h3" className="mb-1">Nastavení</Text>
               <Text variant="muted" className="mb-6 flex-1">Spravujte svůj profil a zabezpečení.</Text>
               <Button variant="secondary" className="w-full">
                 Spravovat
               </Button>
            </div>

          </div>
        </div>
      </div>
    </m.div>
  );
}
