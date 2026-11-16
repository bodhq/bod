"use client";

import { type ComponentProps, type ReactNode, useState } from "react";

import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { RecordForm } from "@/modules/shared/records/components/RecordForm";

type Props = Omit<ComponentProps<typeof RecordForm>, "onCancel"> & {
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  busy?: boolean;
};

export function RecordDialog({
  title,
  description,
  onClose,
  onSave,
  children,
  busy = false,
  ...props
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const confirm = useConfirm();
  const close = () => {
    if (pending || busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    confirm({
      title: "Zahodit rozpracované změny?",
      description: "Formulář ještě není uložený.",
      confirmLabel: "Zahodit změny",
      onConfirm: onClose,
    });
  };
  return (
    <Dialog open onClose={close} title={title} description={description} busy={pending || busy}>
      <div className="mt-6">
        <RecordForm
          {...props}
          onDirtyChange={setDirty}
          onCancel={close}
          onSave={async (body) => {
            setPending(true);
            try {
              return await onSave(body);
            } finally {
              setPending(false);
            }
          }}
        />
      </div>
      {children}
    </Dialog>
  );
}
