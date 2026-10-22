"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteMyAvatarApiV1UsersMeAvatarDelete,
  switchRoleApiV1AuthActiveRolePut,
  updateProfileApiV1UsersMePatch,
  uploadMyAvatarApiV1UsersMeAvatarPut,
} from "@bod/api-client/sdk.gen";
import type { ProfilePatch, UserPublic } from "@bod/api-client/types.gen";

import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { parseApiError } from "@/core/api/api-errors";
import { Button } from "@/core/ui/Button";
import { Input } from "@/core/ui/Input";
import { toast } from "@/core/ui/toast";

import { SettingsPageHeading } from "../components/SettingsPageHeading";

type ProfileValues = Pick<
  ProfilePatch,
  "display_name" | "first_name" | "last_name" | "email" | "phone"
>;

const roleLabels: Record<string, string> = {
  admin: "Administrátor",
  teacher: "Učitel",
  student: "Student",
};

function profileValues(user: UserPublic | null): ProfileValues {
  return {
    display_name: user?.display_name ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  };
}

export default function ProfileSettingsPage() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ProfileValues>(() => profileValues(user));
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => setValues(profileValues(user)), [user]);

  const syncUser = (next: Partial<UserPublic>) => {
    const current = useAuthStore.getState().user;
    if (current) useAuthStore.getState().setUser({ ...current, ...next });
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      const body: ProfilePatch = {
        display_name: values.display_name?.trim() || null,
        first_name: values.first_name?.trim() || null,
        last_name: values.last_name?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
      };
      const { data, error } = await updateProfileApiV1UsersMePatch({ body });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil aktualizovaný profil.");
      return data;
    },
    onSuccess: (data) => {
      syncUser(data);
      toast.success("Osobní údaje byly uloženy.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const { data, error } = await uploadMyAvatarApiV1UsersMeAvatarPut({
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil aktualizovaný profil.");
      return data;
    },
    onSuccess: (data) => {
      setAvatarError(null);
      syncUser(data);
      toast.success("Profilová fotografie byla změněna.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAvatar = useMutation({
    mutationFn: async () => {
      const { error } = await deleteMyAvatarApiV1UsersMeAvatarDelete();
      if (error) throw parseApiError(error);
    },
    onSuccess: () => {
      syncUser({ avatar_url: null });
      toast.success("Profilová fotografie byla odebrána.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const switchRole = useMutation({
    mutationFn: async (roleCode: string) => {
      const { data, error } = await switchRoleApiV1AuthActiveRolePut({
        body: { role_code: roleCode },
      });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil změněnou roli.");
      return data;
    },
    onSuccess: (data) => {
      syncUser(data);
      toast.success("Aktivní role byla změněna.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setField = (field: keyof ProfileValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <section className="w-full max-w-2xl">
      <SettingsPageHeading
        title="Osobní údaje"
        description="Upravte informace spojené s vaším účtem."
      />

      <div className="mb-8 flex flex-col gap-4 rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) p-4 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-(--color-border) bg-(--color-background) text-(--color-muted-foreground)">
          {user?.avatar_url && !avatarError ? (
            // Avatar URL is served by the same API origin and can change after each upload.
            // biome-ignore lint/a11y/useAltText: The adjacent controls label the current avatar.
            <img
              src={user.avatar_url}
              alt="Profilová fotografie"
              onError={() => setAvatarError("Nepodařilo se načíst fotografii.")}
              className="size-full object-cover"
            />
          ) : (
            <UserRound aria-hidden="true" className="size-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Profilová fotografie</p>
          <p className="mt-1 text-sm text-(--color-muted-foreground)">
            PNG, JPEG nebo WebP. Nejvýše 5 MB.
          </p>
          {avatarError && <p className="mt-1 text-sm text-(--color-destructive)">{avatarError}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] bg-(--color-secondary) px-3 text-sm font-semibold text-(--color-secondary-foreground)">
            {uploadAvatar.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            Změnit
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadAvatar.isPending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                if (file.size > 5 * 1024 * 1024)
                  return toast.error("Fotografie může mít nejvýše 5 MB.");
                if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
                  return toast.error("Vyberte obrázek PNG, JPEG nebo WebP.");
                uploadAvatar.mutate(file);
              }}
            />
          </label>
          {user?.avatar_url && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Odebrat fotografii"
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          saveProfile.mutate();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Jméno"
            autoComplete="given-name"
            value={values.first_name ?? ""}
            onChange={(event) => setField("first_name", event.target.value)}
          />
          <Input
            label="Příjmení"
            autoComplete="family-name"
            value={values.last_name ?? ""}
            onChange={(event) => setField("last_name", event.target.value)}
          />
          <Input
            label="Zobrazované jméno"
            autoComplete="nickname"
            value={values.display_name ?? ""}
            onChange={(event) => setField("display_name", event.target.value)}
          />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={values.email ?? ""}
            onChange={(event) => setField("email", event.target.value)}
          />
          <Input
            label="Telefon"
            type="tel"
            autoComplete="tel"
            value={values.phone ?? ""}
            onChange={(event) => setField("phone", event.target.value)}
          />
          <Input label="Uživatelské jméno" value={user?.username ?? ""} readOnly disabled />
        </div>
        <div className="flex justify-end">
          <Button type="submit" isLoading={saveProfile.isPending}>
            Uložit změny
          </Button>
        </div>
      </form>

      {user?.roles && user.roles.length > 1 && (
        <div className="mt-10 border-t border-(--color-border) pt-6">
          <h2 className="text-base font-semibold">Aktivní role</h2>
          <p className="mt-1 text-sm text-(--color-muted-foreground)">
            Role určuje, které části aplikace jsou dostupné.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Button
                key={role}
                variant={user.active_role === role ? "default" : "outline"}
                onClick={() => switchRole.mutate(role)}
                disabled={switchRole.isPending}
              >
                {roleLabels[role] ?? role}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
