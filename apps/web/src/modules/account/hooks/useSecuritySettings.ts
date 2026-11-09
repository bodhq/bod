import { changePasswordApiV1AuthChangePasswordPost } from "@bod/api-client/sdk.gen";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "@/core/api/client";
import { apiData } from "@/core/api/result";
import {
  useRevokeMultipleSessions,
  useRevokeSession,
  useSessions,
} from "@/core/auth/hooks/useSessions";
import { useAuthStore } from "@/core/auth/store";
import { toast } from "@/core/ui/feedback/toast";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";

export function useSecuritySettings() {
  const confirm = useConfirm();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const changePassword = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Nová hesla se neshodují.");
      if (!/\S/.test(newPassword)) {
        throw new Error("Nové heslo musí obsahovat alespoň jeden znak, který není mezera.");
      }
      const result = await changePasswordApiV1AuthChangePasswordPost({
        client: apiClient,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      return apiData(result);
    },
    onSuccess: (user, _variables, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      if (user) useAuthStore.getState().setUser(user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      toast.success("Heslo bylo změněno.");
    },
    onError: (error: Error, _variables, version) => {
      if (version === useAuthStore.getState().sessionVersion) setPasswordError(error.message);
    },
  });
  const { data: sessions, isLoading, isError, error, refetch: refetchSessions } = useSessions();
  const revokeMutation = useRevokeSession();
  const revokeMultipleMutation = useRevokeMultipleSessions();
  const currentSessionId = sessions?.find((session) => session.is_current)?.id ?? null;
  const handleRevoke = (sessionId: string) => {
    if (!currentSessionId || sessionId === currentSessionId) {
      confirm({
        title: "Odhlásit zařízení?",
        description: currentSessionId
          ? "Opravdu se chcete odhlásit z aktuálního zařízení? Budete přesměrováni na přihlašovací obrazovku."
          : "Aktuální zařízení nelze bezpečně rozpoznat. Opravdu chcete tuto relaci odhlásit? Pokud jde o aktuální zařízení, budete přesměrováni na přihlášení.",
        confirmLabel: "Odhlásit",
        destructive: true,
        onConfirm: async () => {
          await revokeMutation.mutateAsync(sessionId);
        },
      });
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
    confirm({
      title: "Odhlásit všechna zařízení?",
      description:
        "Opravdu se chcete odhlásit ze všech zařízení včetně aktuálního? Budete odhlášeni a přesměrováni.",
      confirmLabel: "Odhlásit vše",
      destructive: true,
      onConfirm: async () => {
        await revokeMultipleMutation.mutateAsync(all);
      },
    });
  };
  return {
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
  };
}
