"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

type Me = { id: string; email: string; emailVerified: boolean };

export function DashboardContent() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch(`${getBackendUrl()}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setMe(data);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    try {
      await fetch(`${getBackendUrl()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
    }
  }

  if (!me) return <p>Cargando...</p>;

  return (
    <div className="flex flex-col gap-4 items-center">
      <p>Hola, {me.email}</p>
      {!me.emailVerified && (
        <p role="alert">Todavía no verificaste tu email.</p>
      )}
      <button
        onClick={handleLogout}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
