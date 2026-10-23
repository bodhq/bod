"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { toast } from "@/core/ui/toast";

/**
 * Zpracovává chyby vrácené v URL při přesměrování (např. vypršení relace).
 */
export function useLoginError() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized") {
      toast.error("Vaše relace vypršela nebo byla ukončena. Přihlaste se prosím znovu.");
    }
  }, [searchParams]);
}
