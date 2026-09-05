"use client";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch(`${getBackendUrl()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Ignoramos errores de red: igual mostramos la confirmación genérica,
      // consistente con no revelar si el email existe.
    } finally {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="rune-panel rune-stagger w-full max-w-sm p-8">
        <p className="text-parchment">
          Si el email existe, te enviamos un link para recuperar tu contraseña.
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
        Recuperar contraseña
      </h1>
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
      <button type="submit" className="rune-btn">
        Enviar link
      </button>
    </form>
  );
}
