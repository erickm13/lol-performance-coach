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

    let cancelled = false;

    fetch(`${getBackendUrl()}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "success" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="rune-panel rune-stagger w-full max-w-sm p-8">
      {status === "loading" && (
        <p className="text-mist">Verificando tu email...</p>
      )}
      {status === "success" && (
        <p className="text-parchment">
          ¡Tu email quedó verificado! Ya podés iniciar sesión.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-ember">
          No pudimos verificar tu email. El link puede haber expirado.
        </p>
      )}
    </div>
  );
}
