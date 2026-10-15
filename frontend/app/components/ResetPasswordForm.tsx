"use client";
import { PasswordInput } from "./PasswordInput";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [success, setSuccess] = useState(false);
  const [repeat, setRepeat] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!token) {
      setError("Link inválido");
      return;
    }

    if (newPassword !== repeat) {
      setError("Las contraseñas no coinciden");
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

      setSuccess(true);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rune-panel rune-stagger w-full max-w-sm p-8">
        <h1 className="font-display text-2xl">Contraseña actualizada</h1>
        <p className="page-sub" role="status">
          Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <a href="/login" className="rune-link">Iniciar sesión →</a>
      </div>
    );
  }
  if (!token) {
    return (
      <div className="rune-panel rune-stagger w-full max-w-sm p-8">
        <p role="alert">Este enlace no es válido.</p>
        <a href="/forgot-password" className="rune-link">
          Solicitar un nuevo enlace →
        </a>
      </div>
    );
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
      <p className="password-hint" id="reset-requirements">
        Usa al menos 8 caracteres y confirma tu nueva contraseña.
      </p>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Nueva contraseña
        <PasswordInput
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="reset-requirements"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Confirmar contraseña<PasswordInput
          required
          minLength={8}
          autoComplete="new-password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <button type="submit" disabled={submitting} className="rune-btn">
        {submitting ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
      <a className="rune-link text-sm" href="/forgot-password">
        Solicitar otro enlace de recuperación →
      </a>
    </form>
  );
}
