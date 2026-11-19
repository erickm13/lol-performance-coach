import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 gap-8">
      <Link href="/" className="brand">
        <BrandLogo variant="wordmark" />
      </Link>
      {children}
    </main>
  );
}
