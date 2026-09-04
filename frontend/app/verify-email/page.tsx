"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VerifyEmailStatus } from "../components/VerifyEmailStatus";

function VerifyEmailContent() {
  const params = useSearchParams();
  return <VerifyEmailStatus token={params.get("token")} />;
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <Suspense fallback={<p>Cargando...</p>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
