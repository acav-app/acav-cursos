export async function authedFetch(user, path, init) {
  if (!user) throw new Error("auth_required");
  const token = await user.getIdToken();
  const headers = new Headers(init?.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error || data?.message || "request_failed";
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data;
}

export function asArray(v) {
  return Array.isArray(v) ? v : [];
}

