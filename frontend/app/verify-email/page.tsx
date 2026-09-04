"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VerifyEmailStatus } from "../components/VerifyEmailStatus";
import { AuthShell } from "../components/AuthShell";

function VerifyEmailContent() {
  const params = useSearchParams();
  return <VerifyEmailStatus token={params.get("token")} />;
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="text-mist">Cargando...</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
