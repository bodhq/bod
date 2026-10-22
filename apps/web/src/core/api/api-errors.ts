/** Error translations used by API feedback across the app. */
export type ErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_USER_BANNED"
  | "AUTH_ACCOUNT_LOCKED"
  | "AUTH_UNAUTHENTICATED"
  | "AUTH_LOGIN_UNAVAILABLE"
  | "AUTH_SESSION_NOT_FOUND"
  | "AUTH_FORBIDDEN"
  | "AUTH_PASSWORD_CHANGE_REQUIRED"
  | "RESOURCE_CONFLICT"
  | "MEDIA_FILE_TOO_LARGE"
  | "MEDIA_UNSUPPORTED_TYPE"
  | "MEDIA_UNAVAILABLE"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN_ERROR";

export const errorTranslations: Record<ErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "Nesprávné přihlašovací údaje.",
  AUTH_USER_BANNED: "Tento účet byl zablokován.",
  AUTH_ACCOUNT_LOCKED: "Účet je uzamčen kvůli příliš mnoha pokusům.",
  AUTH_UNAUTHENTICATED: "Nejste přihlášeni.",
  AUTH_LOGIN_UNAVAILABLE: "Přihlašování je dočasně nedostupné.",
  AUTH_SESSION_NOT_FOUND: "Relace nebyla nalezena.",
  AUTH_FORBIDDEN: "K této akci nemáte potřebné oprávnění.",
  AUTH_PASSWORD_CHANGE_REQUIRED: "Před pokračováním si změňte heslo.",
  RESOURCE_NOT_FOUND: "Požadovaný zdroj nebyl nalezen.",
  RESOURCE_CONFLICT: "Tato změna je v konfliktu s aktuálními daty.",
  MEDIA_FILE_TOO_LARGE: "Soubor je příliš velký.",
  MEDIA_UNSUPPORTED_TYPE: "Tento typ souboru není podporován.",
  MEDIA_UNAVAILABLE: "Úložiště souborů je dočasně nedostupné.",
  DATABASE_UNAVAILABLE: "Databáze je dočasně nedostupná.",
  INTERNAL_SERVER_ERROR: "Vnitřní chyba serveru.",
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
  if (structuredError && typeof structuredError === "object") {
    const structured = structuredError as Record<string, unknown>;
    const code = structured.code;
    if (typeof code === "string" && code in errorTranslations) {
      return new Error(errorTranslations[code as ErrorCode]);
    }
    const message =
      typeof structured.message === "string" ? structured.message : errorTranslations.UNKNOWN_ERROR;
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
