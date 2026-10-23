"use client";

import { changePasswordApiV1AuthChangePasswordPost } from "@bod/api-client/sdk.gen";
import { useMutation } from "@tanstack/react-query";
import { Globe, Laptop, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { parseApiError } from "@/core/api/api-errors";
import {
  useRevokeMultipleSessions,
  useRevokeSession,
  useSessions,
} from "@/core/auth/hooks/useSessions";
import { useAuthStore } from "@/core/auth/store";
import { Button } from "@/core/ui/Button";
import { ErrorState } from "@/core/ui/ErrorState";
import { Input } from "@/core/ui/Input";
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Nová hesla se neshodují.");
      if (!/\S/.test(newPassword)) {
        throw new Error("Nové heslo musí obsahovat alespoň jeden znak, který není mezera.");
      }
      const { data, error } = await changePasswordApiV1AuthChangePasswordPost({
        body: { current_password: currentPassword, new_password: newPassword },
      });
      if (error) throw parseApiError(error);
      return data;
    },
    onSuccess: (user) => {
      if (user) useAuthStore.getState().setUser(user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      toast.success("Heslo bylo změněno.");
    },
    onError: (error: Error) => setPasswordError(error.message),
  });
  const { data: sessions, isLoading, isError, error, refetch: refetchSessions } = useSessions();
  const revokeMutation = useRevokeSession();
  const revokeMultipleMutation = useRevokeMultipleSessions();

  const currentSessionId = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const matching = sessions.filter((s) => s.user_agent === ua);
    return matching.length === 1 ? (matching[0]?.id ?? null) : null;
  }, [sessions]);

  const handleRevoke = (sessionId: string) => {
    if (!currentSessionId || sessionId === currentSessionId) {
      toast.confirm(
        currentSessionId
          ? "Opravdu se chcete odhlásit z aktuálního zařízení? Budete přesměrováni na přihlašovací obrazovku."
          : "Aktuální zařízení nelze bezpečně rozpoznat. Opravdu chcete tuto relaci odhlásit? Pokud jde o aktuální zařízení, budete přesměrováni na přihlášení.",
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
        <form
          className="space-y-4 border-b border-(--color-border) pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            setPasswordError(null);
            changePassword.mutate();
          }}
        >
          <div>
            <h2 className="text-sm font-medium">Změnit heslo</h2>
            <p className="mt-1 text-sm text-(--color-muted-foreground)">
              Nové heslo musí mít alespoň 12 znaků.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Současné heslo"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <span className="hidden sm:block" />
            <Input
              label="Nové heslo"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
            <Input
              label="Potvrzení nového hesla"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </div>
          {passwordError && (
            <p className="text-sm text-(--color-destructive)" role="alert">
              {passwordError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" isLoading={changePassword.isPending}>
              Změnit heslo
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-(--color-muted-foreground)" aria-hidden="true" />
            <h2 className="text-sm font-medium">Aktivní zařízení</h2>
          </div>

          {sessions && sessions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRevokeAllOther}
                disabled={
                  revokeMultipleMutation.isPending || sessions.length <= 1 || !currentSessionId
                }
                title={!currentSessionId ? "Aktuální relaci nelze bezpečně určit." : undefined}
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
            <ErrorState
              title="Aktuální relaci se nepodařilo načíst"
              message="Jste přihlášeni, ale server nevrátil žádnou aktivní relaci. Zkuste seznam načíst znovu."
              action={
                <Button variant="outline" size="sm" onClick={() => refetchSessions()}>
                  Načíst znovu
                </Button>
              }
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
