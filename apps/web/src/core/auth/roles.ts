import type { User } from "./api";

const labels: Record<string, string> = {
  admin: "Administrátor",
  teacher: "Učitel",
  student: "Student",
  parent: "Rodič",
};
export function roleLabel(role?: string | null) {
  return role ? (labels[role] ?? role) : "Bez aktivní role";
}

export function schoolRole(user: User | null) {
  return ["student", "parent", "teacher"].includes(user?.active_role ?? "")
    ? user?.active_role
    : null;
}
