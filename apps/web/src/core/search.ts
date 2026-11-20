/** Czech search accepts names with or without diacritics. */
export function searchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("cs")
    .trim();
}
