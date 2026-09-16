export function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyMatch(search: string, target: string): boolean {
  const normalizedSearch = normalizeSearchText(search);
  const normalizedTarget = normalizeSearchText(target);

  if (!normalizedSearch) return true;
  return normalizedTarget.includes(normalizedSearch);
}

export function fuzzySearchObject(
  query: string,
  obj: Record<string, unknown>,
  fields: string[]
): boolean {
  const normalizedSearch = normalizeSearchText(query);
  if (!normalizedSearch) return true;

  return fields.some((field) => {
    const value = obj[field];
    if (value == null) return false;
    if (Array.isArray(value)) {
      return value.some((v) => fuzzyMatch(normalizedSearch, String(v)));
    }
    return fuzzyMatch(normalizedSearch, String(value));
  });
}

export function buildSearchableText(obj: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((field) => {
      const value = obj[field];
      if (value == null) return "";
      if (Array.isArray(value)) return value.map((v) => String(v)).join(" ");
      return String(value);
    })
    .join(" ");
}
