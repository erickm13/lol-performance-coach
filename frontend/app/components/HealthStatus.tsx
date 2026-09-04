"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  db: string;
};

export function HealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${backendUrl}/health`)
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <p role="alert">Error al conectar con el backend: {error}</p>;
  }

  if (!health) {
    return <p>Cargando estado del sistema...</p>;
  }

  return (
    <p>
      Estado del backend: <strong>{health.status}</strong> — Base de datos:{" "}
      <strong>{health.db}</strong>
    </p>
  );
}
