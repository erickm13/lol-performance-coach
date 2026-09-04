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

    const res = await fetch(`${getBackendUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo iniciar sesión");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
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
      <label className="flex flex-col gap-1">
        Contraseña
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
      <a href="/forgot-password" className="text-sm underline">
        ¿Olvidaste tu contraseña?
      </a>
      <a href="/register" className="text-sm underline">
        ¿No tenés cuenta? Registrate
      </a>
    </form>
  );
}
