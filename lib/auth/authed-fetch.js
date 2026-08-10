const TOKEN_STORAGE_KEY = "acav:auth:last_token";

function isString(v) {
  return typeof v === "string" && v.length > 0;
}

async function extractToken(user) {
  if (!user) throw new Error("auth_required");
  if (typeof user.getIdToken === "function") {
    try {
      const token = await user.getIdToken(/* forceRefresh */ false);
      if (isString(token)) return token;
    } catch (_) {
      // ignore and fallback
    }
  }
  const raw = user;
  const candidates = [
    raw?.stsTokenManager?.accessToken,
    raw?.accessToken,
    raw?.idToken,
    raw?.token,
    raw?.authToken,
    raw?.bearerToken,
  ];
  for (const value of candidates) {
    if (isString(value)) return value;
  }
  if (typeof raw?.getToken === "function") {
    try {
      const t = await raw.getToken();
      if (isString(t)) return t;
    } catch (_) {}
  }
  if (typeof raw?.toJSON === "function") {
    try {
      const json = (await raw.toJSON()) || {};
      const nestedCandidates = [
        json?.stsTokenManager?.accessToken,
        json?.accessToken,
        json?.idToken,
        json?.token,
      ];
      for (const value of nestedCandidates) {
        if (isString(value)) return value;
      }
    } catch (_) {}
  }
  try {
    const lastStored = typeof window !== "undefined" ? window.localStorage?.getItem?.(TOKEN_STORAGE_KEY) : null;
    if (isString(lastStored)) return lastStored;
  } catch (_) {}
  throw new Error("auth_token_not_available");
}

function saveTokenFallback(token) {
  if (!isString(token)) return;
  try {
    if (typeof window !== "undefined") window.localStorage?.setItem?.(TOKEN_STORAGE_KEY, token);
  } catch (_) {}
}

async function getUserToken(user) {
  const token = await extractToken(user);
  saveTokenFallback(token);
  return token;
}

export async function authedFetch(user, path, init) {
  if (!user) throw new Error("auth_required");
  const token = await getUserToken(user);
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

export const __internal = { TOKEN_STORAGE_KEY, extractToken, saveTokenFallback };
