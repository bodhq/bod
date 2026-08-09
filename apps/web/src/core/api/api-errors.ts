/**
 * Tyto kódy by měly ideálně v budoucnu pocházet přímo z @bod/api-client,
 * až je kolega na backendu přidá do OpenAPI specifikace.
 * Zatím si je připravíme ručně, abychom měli kam překlady směrovat.
 */
export type ErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_USER_BANNED"
  | "AUTH_ACCOUNT_LOCKED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export const errorTranslations: Record<ErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "Nesprávné přihlašovací údaje.",
  AUTH_USER_BANNED: "Tento účet byl zablokován.",
  AUTH_ACCOUNT_LOCKED: "Účet je uzamčen kvůli příliš mnoha pokusům.",
  VALIDATION_ERROR: "Neplatný formát odeslaných dat.",
  UNKNOWN_ERROR: "Neočekávaná chyba při komunikaci se serverem.",
};

/**
 * Centrální parser pro všechny chyby vrácené z @bod/api-client.
 * Zajišťuje standardizovaný formát chyb napříč celou aplikací.
 */
export function parseApiError(error: unknown): Error {
  // Ochrana před podivnými objekty
  if (!error || typeof error !== "object") {
    return new Error(errorTranslations.UNKNOWN_ERROR);
  }

  // 1. Budoucí standard: Backend vrací { error: { code, message } }
  const structuredError = (error as any).error;
  if (structuredError && typeof structuredError.code === "string") {
    const code = structuredError.code as ErrorCode;
    // Použijeme překlad z našeho slovníku, nebo fallback
    const message =
      errorTranslations[code] ||
      structuredError.message ||
      errorTranslations.UNKNOWN_ERROR;
    return new Error(message);
  }

  // 2. Současný (legacy) FastAPI formát: { detail: "..." }
  const detail = (error as any).detail;
  if (typeof detail === "string") {
    // Prozatímní mapování, než backend přejde na striktní kódy (jen ukázka, pokud je potřeba)
    if (
      detail.includes("Invalid email or password") ||
      detail.includes("Invalid username or password")
    ) {
      return new Error(errorTranslations.AUTH_INVALID_CREDENTIALS);
    }
    // Pokud nemáme mapování, vrátíme surový anglický text od FastAPI
    return new Error(detail);
  }

  // 3. Pydantic formát pro validační chyby (422 Unprocessable Entity): { detail: [{ loc: [...], msg: "..." }] }
  if (Array.isArray(detail)) {
    // Zde bychom ideálně napojili `zod-i18n-map` pro přesný překlad
    return new Error(errorTranslations.VALIDATION_ERROR);
  }

  // Fallback
  return new Error(errorTranslations.UNKNOWN_ERROR);
}
