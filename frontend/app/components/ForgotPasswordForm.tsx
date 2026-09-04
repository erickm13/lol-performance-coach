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
    return <p>Si el email existe, te enviamos un link para recuperar tu contraseña.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <label className="flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
        Enviar link
      </button>
    </form>
  );
}
