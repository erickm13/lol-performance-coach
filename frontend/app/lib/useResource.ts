"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "./api";

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      data?.error ?? "No pudimos completar la solicitud. Intenta de nuevo.",
    );
    Object.assign(error, {
      status: response.status,
      code: data?.code,
      retryAfterSeconds: data?.retryAfterSeconds,
      partial: data?.partial,
    });
    throw error;
  }
  return data as T;
}
export function useResource<T>(path: string) {
  const router = useRouter();
  const [state, setState] = useState<
    { path: string; data: T | null; error: string | null }
  >({ path, data: null, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ path, data: null, error: null });
    apiRequest<T>(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ path, data, error: null });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.status === 401) {
        router.replace("/login");
        return;
      }
      setState({
        path,
        data: null,
        error: error instanceof Error ? error.message : "No se pudo conectar",
      });
    });
    return () => controller.abort();
  }, [path, revision, router]);
  const current = state.path === path ? state : { data: null, error: null };
  return {
    ...current,
    loading: !current.data && !current.error,
    reload: () => setRevision((v) => v + 1),
  };
}
