const labels: Record<string, string> = {
  admin: "Administrátor",
  teacher: "Učitel",
  student: "Student",
  parent: "Rodič",
};
export function roleLabel(role?: string | null) {
  return role ? (labels[role] ?? role) : "Bez aktivní role";
}
