"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { navActive, PRODUCT_LINKS } from "../lib/navigation";
import { BrandLogo } from "./BrandLogo";

export function TopBar({
  onToggleMenu,
  menuOpen,
}: {
  onToggleMenu: () => void;
  menuOpen: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={`app-navbar dashboard-topbar${menuOpen ? " menu-open" : ""}`}
      aria-label="Navegación del dashboard"
    >
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
          <BrandLogo variant="symbol" />
        </div>
      </div>

      <div className="topbar-links">
        {PRODUCT_LINKS.map((l) => {
          const active = navActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`text-sm font-medium transition-colors ${
                active ? "text-teal" : "text-mist hover:text-parchment"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <AccountMenu />
      </div>
    </nav>
  );
}
