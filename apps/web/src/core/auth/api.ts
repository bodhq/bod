/**
 * -----------------------------------------------------------------------------
 * API CONTRACT (Pydantic / OpenAPI Schema)
 * -----------------------------------------------------------------------------
 * Tento soubor slouží jako absolutní zdroj pravdy pro Filipa (Backend).
 * Backend musí vygenerovat Pydantic modely přesně v tomto tvaru.
 */

export type RoleEnum = "student" | "teacher" | "admin";

export interface UserPublic {
  id: number;
  username: string;
  full_name: string;
  role: RoleEnum;
}

export interface BodyAuthLoginApiV1AuthLoginPost {
  username: string;
  password: string;
}

export interface AuthLoginPostData {
  body: BodyAuthLoginApiV1AuthLoginPost;
}

// Exportujeme alias pro zbytek aplikace (aby store nevyžadoval změny po vygenerování klienta)
export type User = UserPublic;

/**
 * MOCK IMPL:
 * Zrcadlí vygenerované metody ze @hey-api/openapi-ts.
 * Budou smazány jakmile se spustí `pnpm gen:api`.
 */
export async function authLoginApiV1AuthLoginPost(
  data: AuthLoginPostData,
): Promise<UserPublic> {
  const { username, password } = data.body;

  if (username === "admin" && password === "heslo") {
    return {
      id: 1,
      username: "admin",
      full_name: "Administrátor",
      role: "admin",
    };
  }

  throw new Error("Špatné přihlašovací údaje");
}

export async function authMeApiV1AuthMeGet(): Promise<UserPublic | null> {
  // Vzhledem k tomu, že se sem požadavek dostane jen pokud middleware ověří cookie,
  // můžeme v mocku bezpečně rovnou vrátit uživatele.
  return {
    id: 1,
    username: "admin",
    full_name: "Administrátor",
    role: "admin",
  };
}

export async function authLogoutApiV1AuthLogoutPost(): Promise<void> {}

// Alias mapping for smooth transition
export const login = authLoginApiV1AuthLoginPost;
export const getMe = authMeApiV1AuthMeGet;
export const logout = authLogoutApiV1AuthLogoutPost;
