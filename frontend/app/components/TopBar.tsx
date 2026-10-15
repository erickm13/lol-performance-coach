"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

const LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Debilidades", href: "/dashboard/debilidades" },
  { label: "Plan", href: "/dashboard/plan" },
];

export function TopBar({
  onToggleMenu,
  menuOpen,
}: {
  onToggleMenu: () => void;
  menuOpen: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="app-navbar">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="menu-toggle"
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Ocultar menú" : "Mostrar menú"}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">LOL PERFORMANCE COACH</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                active ? "text-teal" : "text-mist hover:text-parchment"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <LogoutButton variant="outline" />
      </div>
    </nav>
  );
}
