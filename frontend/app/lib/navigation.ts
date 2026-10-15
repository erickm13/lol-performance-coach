export const PRODUCT_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Entrenamiento", href: "/dashboard/entrenamiento" },
  { label: "Debilidades", href: "/dashboard/debilidades" },
  { label: "Historial", href: "/dashboard/historial" },
  { label: "Academia", href: "/dashboard/academia" },
  { label: "Ranking", href: "/dashboard/ranking" },
  { label: "Preparar partida", href: "/dashboard/preparar" },
];
export function navActive(pathname: string, href: string) {
  if (
    href === "/dashboard/historial" && pathname.startsWith("/dashboard/partida")
  ) return true;
  if (href === "/dashboard/entrenamiento" && pathname === "/dashboard/plan") {
    return true;
  }
  return pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
