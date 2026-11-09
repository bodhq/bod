"use client";

import { Camera, Trash2, UserRound } from "lucide-react";
import { useRef } from "react";

import { roleLabel } from "@/core/auth/roles";
import { Button } from "@/core/ui/actions/Button";
import { toast } from "@/core/ui/feedback/toast";
import { Input } from "@/core/ui/forms/Input";
import { PageHeader, Section } from "@/core/ui/layout/Page";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";

import "../account.css";
import { useProfileSettings } from "../hooks/useProfileSettings";

export default function ProfileView() {
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const model = useProfileSettings();
  const {
    user,
    values,
    avatarError,
    setAvatarError,
    saveProfile,
    uploadAvatar,
    deleteAvatar,
    switchRole,
    setField,
  } = model;
  return (
    <section className="account-settings">
      <PageHeader title="Osobní údaje" description="Upravte informace spojené s vaším účtem." />

      <Section title="Profilová fotografie" description="PNG, JPEG nebo WebP. Nejvýše 5 MB.">
        <div className="profile-photo">
          <div className="profile-avatar">
            {user?.avatar_url && !avatarError ? (
              // Avatar URL is served by the same API origin and can change after each upload.
              // biome-ignore lint/performance/noImgElement: Avatar URLs are short-lived API paths that should bypass image optimization.
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              isLoading={uploadAvatar.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Camera className="size-4" aria-hidden="true" />
              Změnit fotografii
            </Button>
            <input
              ref={fileInput}
              hidden
              aria-label="Profilová fotografie"
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
        {avatarError && (
          <p className="field-error" role="alert">
            {avatarError}
          </p>
        )}
      </Section>

      <Section title="Osobní informace" description="Jméno a kontaktní údaje vašeho účtu.">
        <form
          className="account-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveProfile.mutate();
          }}
        >
          <div className="account-form-grid">
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
      </Section>

      {user?.roles && user.roles.length > 1 && (
        <Section
          title="Aktivní role"
          description="Role určuje, které části aplikace jsou dostupné."
        >
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Button
                key={role}
                variant="choice"
                aria-pressed={user.active_role === role}
                onClick={() => {
                  if (role === user.active_role) return;
                  confirm({
                    title: "Změnit aktivní roli?",
                    description: "Rozpracované údaje se neuloží.",
                    confirmLabel: "Změnit roli",
                    destructive: false,
                    onConfirm: async () => {
                      await switchRole.mutateAsync(role);
                    },
                  });
                }}
                disabled={switchRole.isPending}
              >
                {roleLabel(role)}
              </Button>
            ))}
          </div>
        </Section>
      )}
    </section>
  );
}
