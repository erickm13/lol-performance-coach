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
    <form
      onSubmit={handleSubmit}
      className="rune-panel rune-stagger flex flex-col gap-5 w-full max-w-sm p-8"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Restablecer contraseña
      </h1>
      {error && (
        <p role="alert" className="text-ember text-sm">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Nueva contraseña
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <button type="submit" disabled={submitting} className="rune-btn">
        {submitting ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
