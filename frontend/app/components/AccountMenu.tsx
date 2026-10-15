"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LogoutButton } from "./LogoutButton";
export function AccountMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node && !ref.current?.contains(event.target) &&
        ref.current
      ) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details className="account-menu" ref={ref}>
      <summary
        className={["/dashboard/configuracion", "/dashboard/perfil"].includes(pathname) ? "text-teal" : ""}
      >
        Mi cuenta <span aria-hidden="true">⌄</span>
      </summary>
      <div className="account-menu-popover">
        <Link
          href="/dashboard/configuracion"
          aria-current={pathname === "/dashboard/configuracion"
            ? "page"
            : undefined}
        >
          Configuración de cuenta
        </Link>
        <Link href="/dashboard/perfil" aria-current={pathname === "/dashboard/perfil" ? "page" : undefined}>Mi perfil de jugador</Link>
        <LogoutButton variant="outline" />
      </div>
    </details>
  );
}
