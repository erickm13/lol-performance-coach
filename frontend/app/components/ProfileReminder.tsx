"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "../lib/useResource";
import { type ProfileResponse } from "../lib/player";
export function ProfileReminder() {
  const [incomplete, setIncomplete] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const load = () => {
      void apiRequest<ProfileResponse>("/player/profile").then((data) => {
        if (active) setIncomplete(!data.profile?.onboardingCompleted);
      }).catch(() => {});
    };
    load();
    window.addEventListener("player-profile-updated", load);
    return () => {
      active = false;
      window.removeEventListener("player-profile-updated", load);
    };
  }, []);
  if (!incomplete || dismissed || pathname === "/dashboard/perfil") return null;
  return (
    <aside className="profile-reminder">
      <div>
        <strong>Tu coach puede conocerte mejor</strong>
        <p>
          Elige tus líneas, experiencia y objetivos para adaptar los consejos.
        </p>
      </div>
      <Link href="/dashboard/perfil" className="rune-link">
        Completar mi perfil →
      </Link>
      <button
        type="button"
        aria-label="Ocultar recordatorio durante esta visita"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
