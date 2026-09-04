"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

function ResetPasswordContent() {
  const params = useSearchParams();
  return <ResetPasswordForm token={params.get("token")} />;
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <Suspense fallback={<p>Cargando...</p>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
