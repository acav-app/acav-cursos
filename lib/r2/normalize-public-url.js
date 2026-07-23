export function normalizePublicR2Url(rawUrl) {
  const value = String(rawUrl || "")
    .trim()
    .replace(/^[`"'()\s]+/, "")
    .replace(/[`"'\s]+$/, "")
    .replace(/\)+$/, "");
  if (!value) return "";

  try {
    const url = new URL(value);
    const host = String(url.hostname || "").toLowerCase();

    if (!host.endsWith(".r2.dev")) return value;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[1] === "employment" && parts[0] !== "employment") {
      url.pathname = `/${parts.slice(1).join("/")}`;
      return url.toString();
    }

    return value;
  } catch {
    return value;
  }
}
