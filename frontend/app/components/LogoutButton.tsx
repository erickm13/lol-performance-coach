"use client";

import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function LogoutButton({ variant = "text" }: { variant?: "text" | "outline" }) {
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

  const className = variant === "outline"
    ? "btn-outline"
    : "text-sm text-mist hover:text-parchment transition-colors";

  return (
    <button onClick={handleLogout} className={className}>
      Cerrar sesión
    </button>
  );
}
