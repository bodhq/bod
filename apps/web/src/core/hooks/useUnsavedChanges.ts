"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";

export function useUnsavedChanges(dirty: boolean) {
  const confirm = useConfirm();
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const url = new URL(anchor.href);
      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      confirm({
        title: "Opustit neuložené změny?",
        description: "Úpravy formuláře nejsou uložené. Při odchodu se zahodí.",
        confirmLabel: "Zahodit změny a odejít",
        onConfirm: () => router.push(url.pathname + url.search + url.hash),
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, confirm, router]);
}
