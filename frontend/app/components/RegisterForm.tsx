"use client";
import { PlayerPreferencesFields } from "./PlayerPreferencesFields";
import { emptyPreferences, type PlayerPreferences } from "../lib/player";
import { PasswordInput } from "./PasswordInput";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function RegisterForm() {
  const [preferences, setPreferences] = useState<PlayerPreferences>(emptyPreferences);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
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
        body: JSON.stringify({ email, password, playerProfile: preferences }),
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
      <div className="rune-panel rune-stagger w-full max-w-2xl p-8">
        <p className="text-parchment">
          Revisa tu correo para verificar tu cuenta.
        </p>
        <a href="/login" className="rune-link">Ir a iniciar sesión →</a>
        <p className="password-hint">
          Si no encuentras el mensaje, revisa la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rune-panel rune-stagger flex flex-col gap-5 w-full max-w-2xl p-8"
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
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <p className="password-hint" id="password-requirements">
        Usa al menos 8 caracteres. Puedes mostrar la contraseña para
        comprobarla.
      </p>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Contraseña
        <PasswordInput
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="password-requirements"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Confirmar contraseña
        <PasswordInput
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <fieldset className="registration-preferences" disabled={submitting}><legend>Personaliza tu coach</legend><PlayerPreferencesFields value={preferences} onChange={setPreferences} /></fieldset>
      <button type="submit" disabled={submitting} className="rune-btn">
        {submitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <a href="/login" className="rune-link text-sm pt-1">
        ¿Ya tienes cuenta? Inicia sesión
      </a>
    </form>
  );
}
