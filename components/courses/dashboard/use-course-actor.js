"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";

let cachedUserId = "";
let cachedActor = null;
let cachedError = "";
let inflightRequest = null;

function resetActorCache() {
  cachedUserId = "";
  cachedActor = null;
  cachedError = "";
  inflightRequest = null;
}

async function fetchActor(user) {
  if (!user) {
    resetActorCache();
    return { actor: null, error: "" };
  }

  const nextUserId = String(user.uid || user.email || "");
  if (cachedActor && cachedUserId === nextUserId) {
    return { actor: cachedActor, error: cachedError };
  }

  if (!inflightRequest || cachedUserId !== nextUserId) {
    cachedUserId = nextUserId;
    cachedError = "";
    inflightRequest = authedFetch(user, "/api/courses/me", { method: "GET" })
      .then((data) => {
        cachedActor = data?.actor || null;
        cachedError = "";
        return { actor: cachedActor, error: "" };
      })
      .catch((error) => {
        cachedActor = null;
        cachedError = error?.message || "No se pudo cargar el perfil";
        return { actor: null, error: cachedError };
      })
      .finally(() => {
        inflightRequest = null;
      });
  }

  return inflightRequest;
}

export function useCourseActor() {
  const { user } = useAuth();
  const userId = String(user?.uid || user?.email || "");
  const hasCachedActor = Boolean(userId && cachedActor && cachedUserId === userId);
  const [actor, setActor] = useState(() => (hasCachedActor ? cachedActor : null));
  const [loading, setLoading] = useState(() => (user ? !hasCachedActor : false));
  const [error, setError] = useState(() => (hasCachedActor ? cachedError : ""));

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user) {
        resetActorCache();
        setActor(null);
        setError("");
        setLoading(false);
        return;
      }

      const sameUserCache = cachedUserId === userId;
      if (sameUserCache && cachedActor) {
        setActor(cachedActor);
        setError(cachedError);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await fetchActor(user);
      if (!alive) return;
      setActor(result.actor || null);
      setError(result.error || "");
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [user, userId]);

  return { actor, loading, error };
}
