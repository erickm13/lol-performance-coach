import Link from "next/link";
export function ScreenState(
  { title, children, retry, link }: {
    title: string;
    children?: React.ReactNode;
    retry?: () => void;
    link?: { href: string; label: string };
  },
) {
  return (
    <div className="rune-panel screen-state" role={retry ? "alert" : "status"}>
      <span className="screen-state-mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {retry && (
        <button className="btn-outline" onClick={retry}>Reintentar</button>
      )}
      {link && <Link className="rune-btn" href={link.href}>{link.label}</Link>}
    </div>
  );
}
