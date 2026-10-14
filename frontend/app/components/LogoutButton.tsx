"use client";

import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function LogoutButton() {
  const router = useRouter();

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

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-mist hover:text-parchment transition-colors"
    >
      Cerrar sesión
    </button>
  );
}
