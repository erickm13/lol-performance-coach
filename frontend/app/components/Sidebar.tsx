"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

import { navActive, PRODUCT_LINKS } from "../lib/navigation";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">LOL PERFORMANCE COACH</span>
      </div>

      <nav className="nav-group" aria-label="Pantallas del producto">
        <span className="nav-group-label">Producto</span>
        {PRODUCT_LINKS.map((item) => {
          const active = navActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`nav-item${active ? " active" : ""}`}
            >
              <span className="nav-dot" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot"><Link href="/dashboard/perfil" className="nav-item" onClick={onNavigate} aria-current={pathname === "/dashboard/perfil" ? "page" : undefined}>Mi perfil de jugador</Link>
        <Link
          href="/dashboard/configuracion"
          className="nav-item"
          onClick={onNavigate}
          aria-current={pathname === "/dashboard/configuracion"
            ? "page"
            : undefined}
        >
          Configuración de cuenta
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
