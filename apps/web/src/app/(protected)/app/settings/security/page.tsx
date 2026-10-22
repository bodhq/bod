"use client";

import { Globe, Laptop, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useMemo } from "react";

import {
  useRevokeMultipleSessions,
  useRevokeSession,
  useSessions,
} from "@/core/auth/hooks/useSessions";
import { Button } from "@/core/ui/Button";
import { EmptyState } from "@/core/ui/EmptyState";
import { ErrorState } from "@/core/ui/ErrorState";
import { toast } from "@/core/ui/toast";

import { SettingsPageHeading } from "../components/SettingsPageHeading";

const getDeviceIcon = (userAgent: string | null) => {
  if (!userAgent) return <Globe className="w-5 h-5" />;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="w-5 h-5" />;
  }
  return <Monitor className="w-5 h-5" />;
};

export default function SecuritySettingsPage() {
  const { data: sessions, isLoading, isError, error } = useSessions();
  const revokeMutation = useRevokeSession();
  const revokeMultipleMutation = useRevokeMultipleSessions();

  const currentSessionId = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const matching = sessions.filter((s) => s.user_agent === ua);
    const listToUse = matching.length > 0 ? matching : [...sessions];
    return listToUse.sort(
      (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
    )[0]?.id;
  }, [sessions]);

  const handleRevoke = (sessionId: string) => {
    if (sessionId === currentSessionId) {
      toast.confirm(
        "Opravdu se chcete odhlásit z aktuálního zařízení? Budete přesměrováni na přihlašovací obrazovku.",
        () => revokeMutation.mutateAsync(sessionId),
        { variant: "error", confirmText: "Odhlásit" },
      );
    } else {
      revokeMutation.mutate(sessionId);
    }
  };

  const handleRevokeAllOther = () => {
    if (!sessions || !currentSessionId) return;
    const others = sessions.filter((s) => s.id !== currentSessionId).map((s) => s.id);
    if (others.length === 0) return;
    revokeMultipleMutation.mutate(others);
  };

  const handleRevokeAll = () => {
    if (!sessions) return;
    const all = sessions.map((s) => s.id);
    toast.confirm(
      "Opravdu se chcete odhlásit ze všech zařízení včetně aktuálního? Budete odhlášeni a přesměrováni.",
      () => revokeMultipleMutation.mutateAsync(all),
      { variant: "error", confirmText: "Odhlásit vše" },
    );
  };

  return (
    <section className="w-full max-w-3xl">
      <SettingsPageHeading
        title="Zabezpečení a relace"
        description="Spravujte zařízení, na kterých jste přihlášeni."
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-(--color-muted-foreground)" aria-hidden="true" />
            <h2 className="text-sm font-medium">
              Aktivní zařízení
            </h2>
          </div>

          {sessions && sessions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRevokeAllOther}
                disabled={revokeMultipleMutation.isPending || sessions.length <= 1}
              >
                Odhlásit ostatní
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeAll}
                disabled={revokeMultipleMutation.isPending}
              >
                Odhlásit vše
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <div className="h-20 bg-(--color-surface-200) w-full rounded-xl animate-pulse border border-(--color-border-subtle)" />
              <div className="h-20 bg-(--color-surface-200) w-full rounded-xl animate-pulse border border-(--color-border-subtle)" />
            </div>
          ) : isError ? (
            <ErrorState error={error} title="Nastala chyba při načítání relací" />
          ) : sessions?.length === 0 ? (
            <EmptyState
              icon="🔒"
              title="Žádné aktivní relace"
              description="Momentálně nemáte žádná přihlášená zařízení."
            />
          ) : (
            sessions?.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-100) p-4 sm:flex-row sm:items-center"
                >
                  {isCurrent && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-(--color-primary)" />
                  )}
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden pl-2 sm:w-auto">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-background) text-(--color-muted-foreground)">
                      {getDeviceIcon(session.user_agent ?? null)}
                    </div>
                    <div className="flex flex-col overflow-hidden gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate">
                          {session.ip_address || "Neznámá IP adresa"}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-bold tracking-wider text-(--color-primary) bg-(--color-primary)/10 px-2 py-0.5 rounded-full">
                            Tohle zařízení
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-sm text-(--color-muted-foreground)">
                        {session.user_agent || "Neznámý prohlížeč"}
                      </span>
                      <span className="mt-1 text-xs tabular-nums text-(--color-muted-foreground)">
                        Naposledy: {new Date(session.last_seen_at).toLocaleString("cs-CZ")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={isCurrent ? "secondary" : "destructive"}
                    size="sm"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokeMutation.isPending}
                    className="h-9 shrink-0 self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Odhlásit
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
