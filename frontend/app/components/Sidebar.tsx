"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

type NavLink = { label: string; href: string; ready: boolean };

const PRODUCT_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/dashboard", ready: true },
  { label: "Entrenamiento", href: "/dashboard/entrenamiento", ready: false },
  { label: "Historial de partidas", href: "/dashboard/historial", ready: false },
  { label: "Debilidades detectadas", href: "/dashboard/debilidades", ready: true },
  { label: "Plan de entrenamiento", href: "/dashboard/plan", ready: true },
  { label: "Detalle de partida", href: "/dashboard/partida", ready: false },
  { label: "Configuración de cuenta", href: "/dashboard/configuracion", ready: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">LOL PERFORMANCE COACH</span>
      </div>

      <nav className="nav-group">
        <span className="nav-group-label">Producto</span>
        {PRODUCT_LINKS.map((item) => {
          const active = pathname === item.href;
          if (!item.ready) {
            return (
              <span
                key={item.href}
                className="nav-item disabled"
                title="Próximamente"
                aria-disabled="true"
              >
                <span className="nav-dot" />
                {item.label}
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
            >
              <span className="nav-dot" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <LogoutButton />
      </div>
    </aside>
  );
}
