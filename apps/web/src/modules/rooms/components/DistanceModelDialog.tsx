"use client";

import type { RoomDistanceModelsCreate, RoomDistanceModelsRead } from "@bod/api-client/types.gen";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Input } from "@/core/ui/forms/Input";
import { Textarea } from "@/core/ui/forms/Textarea";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { Dialog } from "@/core/ui/overlays/Dialog";

export function DistanceModelDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: RoomDistanceModelsRead;
  onSave: (id: string, body: RoomDistanceModelsCreate) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const confirm = useConfirm();
  const save = useMutation({
    mutationFn: () =>
      onSave(initial.id, { name: name.trim(), description: description.trim() || null }),
    onSuccess: onClose,
  });
  const dirty = name !== initial.name || description !== (initial.description ?? "");
  useUnsavedChanges(dirty && !save.isSuccess);
  const close = () => {
    if (save.isPending) return;
    if (dirty)
      confirm({
        title: "Zahodit úpravy nastavení?",
        description: "Název a popis ještě nejsou uložené.",
        confirmLabel: "Zahodit změny",
        onConfirm: onClose,
      });
    else onClose();
  };
  return (
    <Dialog
      open
      title="Přejmenovat nastavení přesunů"
      description="Tento název uvidíte při přípravě rozvrhu. Uložené přesuny zůstanou zachované."
      onClose={close}
    >
      <form
        className="ui-stack mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Input
          label="Název nastavení"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          autoFocus
          disabled={save.isPending}
          placeholder="Např. Přesuny ve škole"
        />
        <Textarea
          label="Popis"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={save.isPending}
        />
        {save.isError && <ErrorState error={save.error} />}
        <div className="page-actions justify-end">
          <Button variant="outline" onClick={close} disabled={save.isPending}>
            Zrušit
          </Button>
          <Button type="submit" isLoading={save.isPending} disabled={!name.trim()}>
            Uložit název
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
