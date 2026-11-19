import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function Navbar({ actions }: { actions?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-6">
      <nav className="app-navbar">
        <div className="brand">
          <BrandLogo variant="wordmark" />
        </div>
        <div className="flex items-center gap-5">
          <Link className="rune-link no-underline font-medium" href="/dashboard">
            Dashboard
          </Link>
          {actions}
        </div>
      </nav>
    </div>
  );
}
