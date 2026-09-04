"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${getBackendUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }

      router.push("/dashboard");
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
        Iniciar sesión
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rune-field text-parchment text-base"
        />
      </label>
      <button type="submit" disabled={submitting} className="rune-btn">
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
      <div className="flex flex-col gap-2 text-sm pt-1">
        <a href="/forgot-password" className="rune-link">
          ¿Olvidaste tu contraseña?
        </a>
        <a href="/register" className="rune-link">
          ¿No tenés cuenta? Registrate
        </a>
      </div>
    </form>
  );
}
