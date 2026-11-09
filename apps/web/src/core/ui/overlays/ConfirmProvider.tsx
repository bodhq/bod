"use client";

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";

import { Dialog } from "./Dialog";

interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => unknown;
}
const ConfirmContext = createContext<((options: Confirmation) => void) | null>(null);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const confirm = useCallback((options: Confirmation) => {
    if (active.current) return;
    active.current = true;
    setError(null);
    setRequest(options);
  }, []);
  const close = () => {
    if (busy) return;
    active.current = false;
    setRequest(null);
    setError(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!request}
        onClose={close}
        title={request?.title ?? "Potvrzení"}
        description={request?.description}
      >
        {error && <ErrorState className="mt-4" message={error} />}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" autoFocus disabled={busy} onClick={close}>
            Zrušit
          </Button>
          <Button
            variant={request?.destructive ? "destructive" : "default"}
            isLoading={busy}
            onClick={async () => {
              if (!request || busy) return;
              setBusy(true);
              try {
                await request.onConfirm();
                active.current = false;
                setRequest(null);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Změnu se nepodařilo provést. Zkuste to znovu.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Provádím změnu…" : request?.confirmLabel}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm vyžaduje ConfirmProvider.");
  return confirm;
}
