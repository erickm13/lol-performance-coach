"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Link inválido");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo restablecer la contraseña");
        return;
      }

      router.push("/login");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        Nueva contraseña
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        {submitting ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
