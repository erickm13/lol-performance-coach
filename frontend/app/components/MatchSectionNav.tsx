"use client";
import { useEffect, useRef, useState } from "react";
const SECTIONS = [
  { id: "match-overview", label: "Resumen" },
  { id: "match-teams", label: "Equipos" },
  { id: "match-map", label: "Mapa" },
];
export function MatchSectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const edge = (navRef.current?.getBoundingClientRect().bottom ?? 70) + 32;
      let current = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= edge) {
          current = section.id;
        }
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <nav
      className="match-section-nav"
      data-reveal="fade"
      aria-label="Secciones de la partida"
      ref={navRef}
    >
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? "location" : undefined}
          onClick={(event) => {
            event.preventDefault();
            const target = document.getElementById(section.id);
            if (!target) return;
            setActive(section.id);
            window.history.replaceState(null, "", `#${section.id}`);
            target.focus({ preventScroll: true });
            target.scrollIntoView({
              behavior:
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              block: "start",
            });
          }}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
