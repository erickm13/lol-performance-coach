"use client";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo completar el registro");
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
        <p className="text-parchment">
          Revisá tu correo para verificar tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rune-panel rune-stagger flex flex-col gap-5 w-full max-w-sm p-8"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Crear cuenta
      </h1>
      {error && (
        <p role="alert" className="text-ember text-sm">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Contraseña
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Confirmar contraseña
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <button type="submit" disabled={submitting} className="rune-btn">
        {submitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <a href="/login" className="rune-link text-sm pt-1">
        ¿Ya tenés cuenta? Iniciá sesión
      </a>
    </form>
  );
}
