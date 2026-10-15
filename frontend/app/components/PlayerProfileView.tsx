"use client";
import Link from "next/link";
import { useState } from "react";
import { apiRequest, useResource } from "../lib/useResource";
import {
  emptyPreferences,
  type PlayerPreferences,
  type PlayerProfile,
  type ProfileResponse,
} from "../lib/player";
import { PlayerPreferencesFields } from "./PlayerPreferencesFields";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { ScreenState } from "./ScreenState";
function Editor({ initial }: { initial: PlayerPreferences }) {
  const [value, setValue] = useState<PlayerPreferences>(initial);
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  return (
    <form
      className="section-surface player-profile-editor"
      data-reveal="up"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
          const data = await apiRequest<{ profile: PlayerProfile }>(
            "/player/profile",
            { method: "PUT", body: JSON.stringify(value) },
          );
          setValue(data.profile);
          setMessage(
            data.profile.onboardingCompleted
              ? "Perfil guardado. El coach usará tus preferencias en las próximas respuestas."
              : "Perfil guardado. Elige línea principal, experiencia y al menos un objetivo para completar tu perfil.",
          );
          window.dispatchEvent(new Event("player-profile-updated"));
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo guardar tu perfil.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <header className="champ-stats-head">
        <h3>Tu perfil de jugador</h3>
        <span>Tus preferencias para el coach</span>
      </header>
      <div className="section-body">
        <fieldset disabled={saving} aria-label="Preferencias del jugador">
          <PlayerPreferencesFields value={value} onChange={setValue} />
        </fieldset>
        {error && <p className="text-ember" role="alert">{error}</p>}
        {message && <p className="text-teal" role="status">{message}</p>}
        <div className="profile-save-actions">
          <button className="rune-btn" disabled={saving}>
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
          <Link href="/dashboard/entrenamiento" className="rune-link">
            Ir a mi entrenamiento →
          </Link>
        </div>
      </div>
    </form>
  );
}
export function PlayerProfileView() {
  const resource = useResource<ProfileResponse>("/player/profile");
  if (resource.error) {
    return (
      <ScreenState title="No pudimos cargar tu perfil" retry={resource.reload}>
        {resource.error}
      </ScreenState>
    );
  }
  if (!resource.data) return <ScreenState title="Preparando tu perfil…" />;
  const { profile, account } = resource.data;
  return (
    <ScrollRevealRoot className="screen-stack motion-page player-profile-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Mi perfil de jugador</h2>
          <p className="page-sub">
            Tu forma de jugar, tus objetivos y el tiempo que quieres dedicarles.
          </p>
        </div>
        <Link href="/dashboard/configuracion" className="rune-link">
          Configuración de cuenta →
        </Link>
      </header>
      {account && (
        <div className="analysis-sample" data-reveal="up">
          <div>
            <span className="teaser-label">Tu cuenta vinculada</span>
            <p>{account.summonerName}#{account.tagLine}</p>
          </div>
          <div>
            <span className="teaser-label">
              Rango oficial · {account.region}
            </span>
            <p>
              {account.soloTier
                ? `${account.soloTier} ${account.soloRank ?? ""} · ${
                  account.soloLp ?? 0
                } LP`
                : "Sin rango clasificatorio guardado"}
            </p>
          </div>
        </div>
      )}
      <Editor initial={profile ?? emptyPreferences} />
    </ScrollRevealRoot>
  );
}
