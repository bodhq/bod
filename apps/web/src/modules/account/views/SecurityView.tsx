"use client";

import { Globe, Laptop, Monitor, Smartphone, Trash2 } from "lucide-react";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Input } from "@/core/ui/forms/Input";
import { PageHeader, Section } from "@/core/ui/layout/Page";

import "../account.css";
import { useSecuritySettings } from "../hooks/useSecuritySettings";

const getDeviceIcon = (userAgent: string | null) => {
  if (!userAgent) return <Globe className="w-5 h-5" />;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="w-5 h-5" />;
  }
  return <Monitor className="w-5 h-5" />;
};

export default function SecurityView() {
  const model = useSecuritySettings();
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordError,
    setPasswordError,
    changePassword,
    sessions,
    isLoading,
    isError,
    error,
    refetchSessions,
    revokeMutation,
    revokeMultipleMutation,
    currentSessionId,
    handleRevoke,
    handleRevokeAllOther,
    handleRevokeAll,
  } = model;
  return (
    <section className="account-settings">
      <PageHeader
        title="Zabezpečení a relace"
        description="Spravujte zařízení, na kterých jste přihlášeni."
      />

      <div>
        <Section title="Změnit heslo" description="Nové heslo musí mít alespoň 12 znaků.">
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              setPasswordError(null);
              changePassword.mutate();
            }}
          >
            <div className="account-form-grid">
              <Input
                label="Současné heslo"
                className="sm:col-span-2"
                fieldWidth="standard"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
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
        </Section>

        <Section
          title="Aktivní zařízení"
          description="Zkontrolujte přihlášení a odhlaste nepoužívaná zařízení."
          icon={<Laptop aria-hidden="true" />}
        >
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
                variant="secondary"
                size="sm"
                onClick={handleRevokeAll}
                disabled={revokeMultipleMutation.isPending}
              >
                Odhlásit vše
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-(--section-gap)">
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
                  <div key={session.id} className="session-card" data-current={isCurrent}>
                    <div className="flex min-w-0 items-center gap-3 overflow-hidden sm:w-auto">
                      <div className="flex size-10 shrink-0 items-center justify-center text-(--color-muted-foreground)">
                        {getDeviceIcon(session.user_agent ?? null)}
                      </div>
                      <div className="flex flex-col overflow-hidden gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">
                            {session.ip_address || "Neznámá IP adresa"}
                          </span>
                          {isCurrent && <span className="session-current">Tohle zařízení</span>}
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
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRevoke(session.id)}
                      disabled={revokeMutation.isPending}
                      className="shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Odhlásit
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Section>
      </div>
    </section>
  );
}
