"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

export function VerifyEmailStatus({ token }: { token: string | null }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`${getBackendUrl()}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") return <p>Verificando tu email...</p>;
  if (status === "success") {
    return <p>¡Tu email quedó verificado! Ya podés iniciar sesión.</p>;
  }
  return (
    <p role="alert">
      No pudimos verificar tu email. El link puede haber expirado.
    </p>
  );
}
