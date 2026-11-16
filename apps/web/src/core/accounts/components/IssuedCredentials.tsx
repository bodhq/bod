"use client";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { toast } from "@/core/ui/feedback/toast";
export function IssuedCredentials({
  accounts,
  onDismiss,
}: {
  accounts: { username: string; password: string }[];
  onDismiss: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  if (!accounts.length) return null;
  return (
    <section
      aria-label="Nové přihlašovací údaje"
      className="space-y-3 rounded-xl bg-(--color-surface-100) p-4"
    >
      <h2 className="font-semibold" role="status">
        Dočasná hesla jsou připravená
      </h2>
      <p className="text-sm text-(--color-muted-foreground)">
        Zobrazí se pouze nyní. Každému uživateli bezpečně předejte pouze jeho vlastní údaje.
      </p>
      <ul className="divide-y divide-(--color-border)">
        {accounts.map(({ username, password }) => (
          <li key={username} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{username}</p>
              <code className="mt-1 block break-all text-sm">{password}</code>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Kopírovat heslo pro ${username}`}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(password);
                  setError(null);
                  toast.success(`Heslo pro ${username} zkopírováno.`);
                } catch {
                  setError("Heslo se nepodařilo zkopírovat. Zkopírujte jej ručně.");
                }
              }}
            >
              Kopírovat
            </Button>
          </li>
        ))}
      </ul>
      {error && <ErrorState message={error} />}
      <Button variant="outline" onClick={onDismiss}>
        Skrýt přihlašovací údaje
      </Button>
    </section>
  );
}
