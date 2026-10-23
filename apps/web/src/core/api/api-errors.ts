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

type ParsedApiError = Error & { code?: string; status?: number };

function makeApiError(message: string, source: unknown, code?: string): ParsedApiError {
  const value = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const response =
    value.response && typeof value.response === "object"
      ? (value.response as Record<string, unknown>)
      : undefined;
  const status =
    typeof value.status === "number"
      ? value.status
      : typeof response?.status === "number"
        ? response.status
        : undefined;
  return Object.assign(new Error(message), {
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
  });
}

/**
 * Centrální parser pro všechny chyby vrácené z @bod/api-client.
 * Zajišťuje standardizovaný formát chyb napříč celou aplikací.
 */
export function parseApiError(error: unknown): Error {
  // Ochrana před podivnými objekty
  if (!error || typeof error !== "object") {
    return makeApiError(errorTranslations.UNKNOWN_ERROR, error);
  }

  const payload = error as Record<string, unknown>;

  // Backend contract: { error: { code, message } }
  const structuredError = payload.error;
  if (structuredError && typeof structuredError === "object") {
    const structured = structuredError as Record<string, unknown>;
    const code = structured.code;
    const message = structured.message;
    if (typeof message === "string" && message.trim()) {
      const details = Array.isArray(structured.details)
        ? structured.details.flatMap((detail) => {
            if (!detail || typeof detail !== "object") return [];
            const issue = detail as Record<string, unknown>;
            if (typeof issue.message !== "string" || !issue.message.trim()) return [];
            const location = Array.isArray(issue.location)
              ? issue.location.filter(
                  (part): part is string | number =>
                    typeof part === "string" || typeof part === "number",
                )
              : [];
            const field = location
              .filter((part) => !["body", "query", "path", "header"].includes(String(part)))
              .join(".");
            return [field ? `${field}: ${issue.message}` : issue.message];
          })
        : [];
      const fullMessage = details.length ? `${message} — ${details.join("; ")}` : message;
      return makeApiError(fullMessage, error, typeof code === "string" ? code : undefined);
    }
    if (typeof code === "string" && code in errorTranslations) {
      return makeApiError(errorTranslations[code as ErrorCode], error, code);
    }
    return makeApiError(
      errorTranslations.UNKNOWN_ERROR,
      error,
      typeof code === "string" ? code : undefined,
    );
  }

  // 2. Současný (legacy) FastAPI formát: { detail: "..." }
  const detail = payload.detail;
  if (typeof detail === "string") {
    // Compatibility mapping for older backend responses.
    if (
      detail.includes("Invalid email or password") ||
      detail.includes("Invalid username or password")
    ) {
      return makeApiError(
        errorTranslations.AUTH_INVALID_CREDENTIALS,
        error,
        "AUTH_INVALID_CREDENTIALS",
      );
    }
    // Pokud nemáme mapování, vrátíme surový anglický text od FastAPI
    return makeApiError(detail, error);
  }

  // 3. Pydantic formát pro validační chyby (422 Unprocessable Entity): { detail: [{ loc: [...], msg: "..." }] }
  if (Array.isArray(detail)) {
    const firstMessage = detail.find(
      (item): item is { msg: string } =>
        typeof item === "object" && item !== null && "msg" in item && typeof item.msg === "string",
    )?.msg;
    if (firstMessage) return makeApiError(firstMessage, error, "VALIDATION_ERROR");
    return makeApiError(errorTranslations.VALIDATION_ERROR, error, "VALIDATION_ERROR");
  }

  // Fallback
  return makeApiError(errorTranslations.UNKNOWN_ERROR, error);
}
