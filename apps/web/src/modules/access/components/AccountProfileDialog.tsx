"use client";

import type { UserRead } from "@bod/api-client/types.gen";
import type { FieldDefinition } from "@/modules/shared/records/types";
import type { useAccessManagement } from "../hooks/useAccessManagement";

import {
  deleteAvatarApiV1UsersUserIdAvatarDelete,
  uploadAvatarApiV1UsersUserIdAvatarPut,
} from "@bod/api-client/sdk.gen";
import { zUserPatch } from "@bod/api-client/zod.gen";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { refreshAuthUser } from "@/core/auth/session";
import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Input } from "@/core/ui/forms/Input";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";

const fields: FieldDefinition[] = [
  {
    name: "username",
    label: "Přihlašovací jméno",
    type: "string",
    required: true,
    nullable: false,
    maxLength: 64,
  },
  ...[
    { name: "first_name", label: "Jméno" },
    { name: "last_name", label: "Příjmení" },
    { name: "display_name", label: "Zobrazované jméno" },
  ].map((field) => ({
    ...field,
    type: "string" as const,
    required: false,
    nullable: true,
    maxLength: 150,
  })),
  {
    name: "email",
    label: "E-mail",
    type: "email",
    required: false,
    nullable: true,
    maxLength: 254,
  },
  {
    name: "phone",
    label: "Telefon",
    type: "string",
    required: false,
    nullable: true,
    maxLength: 32,
  },
];
export function AccountProfileDialog({
  account,
  model,
  onClose,
}: {
  account: UserRead;
  model: ReturnType<typeof useAccessManagement>;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const user = useAuthUser();
  const canPhoto = account.id !== user?.id || !!user?.permissions?.includes("profile.self.update");
  const [avatar, setAvatar] = useState(account.avatar_url);
  const photo = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async (file: File | null) => {
      if (!file) {
        apiVoid(
          await deleteAvatarApiV1UsersUserIdAvatarDelete({
            client: apiClient,
            path: { user_id: account.id },
          }),
        );
        return null;
      }
      if (file.size > 5 * 1024 * 1024) throw new Error("Fotografie může mít nejvýše 5 MB.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Vyberte obrázek PNG, JPEG nebo WebP.");
      return apiData(
        await uploadAvatarApiV1UsersUserIdAvatarPut({
          client: apiClient,
          path: { user_id: account.id },
          body: file,
          headers: { "Content-Type": file.type },
        }),
      ).avatar_url;
    },
    onSuccess: async (url, _file, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      setAvatar(url);
      await client.invalidateQueries({ queryKey: ["access", "users"] });
      if (useAuthStore.getState().user?.id === account.id) await refreshAuthUser(client);
    },
  });
  return (
    <RecordDialog
      title={`Upravit účet: ${account.display_name || account.username}`}
      editing
      initial={{ ...account }}
      fields={fields}
      busy={photo.isPending}
      onClose={onClose}
      onSave={async (body) => {
        const version = useAuthStore.getState().sessionVersion;
        await model.updateAccount.mutateAsync({ account, patch: zUserPatch.parse(body) });
        if (version !== useAuthStore.getState().sessionVersion) return;
        if (useAuthStore.getState().user?.id === account.id) await refreshAuthUser(client);
        onClose();
      }}
    >
      {canPhoto && (
        <section
          className="ui-stack mt-4 border-t border-(--color-border) pt-4"
          aria-label="Fotografie účtu"
        >
          <h3 className="font-semibold">Profilová fotografie</h3>
          {avatar && (
            <Image
              unoptimized
              src={avatar}
              alt={`Fotografie: ${account.display_name || account.username}`}
              width={64}
              height={64}
              className="rounded-(--radius) object-cover"
            />
          )}
          <Input
            type="file"
            label="Nahrát fotografii"
            description="PNG, JPEG nebo WebP, nejvýše 5 MB. Fotografie se ukládá samostatně."
            accept="image/png,image/jpeg,image/webp"
            disabled={photo.isPending || model.updateAccount.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) photo.mutate(file);
            }}
          />
          {avatar && (
            <Button
              variant="outline"
              disabled={photo.isPending || model.updateAccount.isPending}
              onClick={() => photo.mutate(null)}
            >
              Odstranit fotografii
            </Button>
          )}
          {photo.isPending && <p role="status">Ukládám fotografii…</p>}
          {photo.isSuccess && <p role="status">Fotografie byla aktualizována.</p>}
          {photo.isError && <ErrorState error={photo.error} />}
        </section>
      )}
    </RecordDialog>
  );
}
