"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "../components/ResetPasswordForm";
import { AuthShell } from "../components/AuthShell";

function ResetPasswordContent() {
  const params = useSearchParams();
  return <ResetPasswordForm token={params.get("token")} />;
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="text-mist">Cargando...</p>}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
