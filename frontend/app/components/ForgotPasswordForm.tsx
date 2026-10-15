"use client";
import { useState } from "react";
import { apiRequest } from "../lib/useResource";
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError(
        "No pudimos enviar la solicitud. Comprueba tu conexión e intenta de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (submitted) {
    return (
      <div className="rune-panel rune-stagger w-full max-w-sm p-8">
        <h1 className="font-display text-2xl">Revisa tu correo</h1>
        <p className="page-sub" role="status">
          Si existe una cuenta con ese email, recibirás un enlace para recuperar
          tu contraseña. Revisa también la carpeta de spam.
        </p>
        <a href="/login" className="rune-link">Volver a iniciar sesión →</a>
      </div>
    );
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="rune-panel rune-stagger flex flex-col gap-5 w-full max-w-sm p-8"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Recuperar contraseña
      </h1>
      <p className="password-hint">
        Escribe el correo que usaste al crear tu cuenta.
      </p>
      {error && <p className="text-ember text-sm" role="alert">{error}</p>}
      <label className="flex flex-col gap-1.5 text-sm text-mist">
        Email<input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <button type="submit" className="rune-btn" disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar enlace"}
      </button>
      <a href="/login" className="rune-link">Volver al acceso →</a>
    </form>
  );
}
