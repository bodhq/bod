"use client";

import { ChevronLeft, Globe, Monitor, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessions, revokeSession } from "@/core/auth/api";
import { Text } from "@/core/ui/Text";
import * as React from "react";

// Pomocná funkce pro určení ikony
const getDeviceIcon = (userAgent: string | null) => {
  if (!userAgent) return <Globe className="w-5 h-5" />;
  if (userAgent.toLowerCase().includes("mobile") || userAgent.toLowerCase().includes("android") || userAgent.toLowerCase().includes("iphone")) {
      return <Smartphone className="w-5 h-5" />;
  }
  return <Monitor className="w-5 h-5" />;
};

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, isError, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => {
      console.error("Failed to revoke session:", error);
      alert("Nepodařilo se odhlásit zařízení.");
    }
  });

  return (
    <div className="flex flex-col gap-8 pb-32 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out px-4 sm:px-8 pt-8">
      {/* Apple-style Header */}
      <header className="flex flex-col gap-3">
        <Link href="/app/settings" className="flex items-center text-body-small font-semibold text-(--color-primary) hover:underline w-fit">
          <ChevronLeft className="w-4 h-4 mr-0.5" /> Zpět na nastavení
        </Link>
        <div className="flex flex-col gap-1">
            <Text variant="h1">Zabezpečení a relace</Text>
            <Text variant="muted-lg">
            Spravujte zařízení, ze kterých jste aktuálně přihlášeni.
            </Text>
        </div>
      </header>

      {/* Content - Premium Login Card Style */}
      <div className="w-full rounded-3xl sm:rounded-[2rem] bg-(--color-surface-100) p-6 sm:p-10 shadow-xl shadow-black/5 dark:shadow-black/20 border border-black/10 dark:border-white/10 relative overflow-hidden flex flex-col gap-6">
        <Text variant="h2">Aktivní zařízení</Text>
        
        {isLoading ? (
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-24 bg-(--color-surface-200) rounded-2xl w-full border border-(--color-border-subtle)" />
            <div className="h-24 bg-(--color-surface-200) rounded-2xl w-full border border-(--color-border-subtle)" />
          </div>
        ) : isError ? (
          <Text variant="body" className="text-(--color-destructive)">Nastala chyba při načítání relací: {(error as Error)?.message}</Text>
        ) : sessions?.length === 0 ? (
          <Text variant="muted">Žádné aktivní relace.</Text>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions?.map((session) => (
              <div 
                key={session.id} 
                className="flex items-center justify-between p-4 sm:p-6 rounded-2xl bg-(--color-surface-200) border border-(--color-border-subtle) hover:border-(--color-border-strong) transition-colors"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-3 bg-(--color-surface-100) ring-1 ring-black/5 dark:ring-white/5 rounded-xl flex items-center justify-center shadow-sm shrink-0 text-(--color-muted-foreground)">
                        {getDeviceIcon(session.user_agent ?? null)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <Text variant="body-large" className="font-bold truncate">
                            {session.ip_address || "Neznámá IP adresa"}
                        </Text>
                        <Text variant="muted" className="truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                            {session.user_agent || "Neznámý prohlížeč"}
                        </Text>
                        <Text variant="caption" className="mt-1.5 bg-(--color-surface-0) w-fit px-2.5 py-0.5 rounded-full ring-1 ring-black/10 dark:ring-white/10 shadow-sm">
                            Aktivní: {new Date(session.last_seen_at).toLocaleString('cs-CZ')}
                        </Text>
                    </div>
                </div>
                <button
                    onClick={() => revokeMutation.mutate(session.id)}
                    disabled={revokeMutation.isPending}
                    className="p-3 ml-2 text-(--color-destructive) hover:bg-(--color-destructive)/10 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Odhlásit z tohoto zařízení"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
