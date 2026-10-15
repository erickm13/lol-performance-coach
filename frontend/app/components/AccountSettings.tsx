"use client";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { PasswordInput } from "./PasswordInput";
import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, useResource } from "../lib/useResource";
import { ScreenState } from "./ScreenState";
type Profile = {
  user: { email: string; emailVerified: boolean };
  account: {
    summonerName: string;
    tagLine: string;
    region: string;
    linkedAt: string;
  } | null;
};
export function AccountSettings() {
  const profile = useResource<Profile>("/settings/profile");
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [action, setAction] = useState<"unlink" | "delete" | null>(null);
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState(false);
  const confirmationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!action) return;
    confirmationRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    confirmationRef.current?.querySelector<HTMLInputElement>("input")?.focus({
      preventScroll: true,
    });
  }, [action]);
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (changing || removing) return;
    setMessage(null);
    setPasswordError(null);
    if (newPassword !== repeat) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setChanging(true);
    try {
      await apiRequest("/settings/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setRepeat("");
      setMessage("Contraseña actualizada correctamente.");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la contraseña.",
      );
    } finally {
      setChanging(false);
    }
  }
  function beginAction(next: "unlink" | "delete") {
    setAction(next);
    setConfirmationPassword("");
    setConfirmation("");
    setRemoveError(null);
  }
  async function remove(e: FormEvent) {
    e.preventDefault();
    if (removing || changing || !action) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await apiRequest(
        action === "unlink" ? "/settings/riot-account" : "/settings/account",
        {
          method: "DELETE",
          body: JSON.stringify({
            password: confirmationPassword,
            confirmation,
          }),
        },
      );
      if (action === "delete") {
        router.replace("/login?deleted=1");
        router.refresh();
      } else {
        setAction(null);
        setConfirmationPassword("");
        setUnlinked(true);
        profile.reload();
      }
    } catch (error) {
      setRemoveError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la solicitud.",
      );
    } finally {
      setRemoving(false);
    }
  }
  if (profile.loading) return <ScreenState title="Cargando configuración…" />;
  if (profile.error || !profile.data) {
    return (
      <ScreenState
        title="No pudimos cargar tu configuración"
        retry={profile.reload}
      >
        {profile.error}
      </ScreenState>
    );
  }
  const { user, account } = profile.data;
  return (
    <ScrollRevealRoot className="screen-stack motion-page settings-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Configuración de cuenta</h2>
          <p className="page-sub">
            Tus credenciales y tu conexión con Riot, en un solo lugar.
          </p>
        </div>
      </header>
      <nav className="settings-tabs" aria-label="Secciones de configuración">
        <a href="#settings-profile">Perfil</a>
        <a href="#settings-security">Seguridad</a>
        <a href="#settings-riot">Riot</a>
      </nav>
      <section
        id="settings-profile"
        className="rune-panel settings-section"
        data-reveal="up"
      >
        <div className="settings-row">
          <div>
            <span className="teaser-label">Tu cuenta</span>
            <h3>{user.email}</h3>
          </div>
          <span
            className={`badge badge-${user.emailVerified ? "low" : "medium"}`}
          >
            {user.emailVerified
              ? "Email verificado"
              : "Email pendiente de verificación"}
          </span>
        </div>
      </section>
      <section className="section-surface" data-reveal="up"><header className="champ-stats-head"><h3>Tu perfil de jugador</h3></header><div className="section-body"><p className="page-sub">Edita tus líneas, campeones, objetivos, tiempo de práctica, universidad y participación en el ranking.</p><Link className="rune-link" href="/dashboard/perfil">Editar mi perfil de jugador →</Link></div></section>
      <section
        id="settings-security"
        className="rune-panel settings-section"
        data-reveal="up"
      >
        <h3>Seguridad · Cambiar contraseña</h3>
        <p className="page-sub">
          Usa al menos 8 caracteres para tu nueva contraseña.
        </p>
        <form onSubmit={changePassword} className="settings-form">
          <label className="field-label" htmlFor="current-password">
            Contraseña actual<PasswordInput
              id="current-password"
              className="rune-field"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="field-label" htmlFor="new-password">
            Nueva contraseña<PasswordInput
              id="new-password"
              className="rune-field"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="field-label" htmlFor="repeat-password">
            Repetir nueva contraseña<PasswordInput
              id="repeat-password"
              className="rune-field"
              autoComplete="new-password"
              required
              minLength={8}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
          {passwordError && (
            <p className="text-ember" role="alert">{passwordError}</p>
          )}
          {message && <p className="text-teal" role="status">{message}</p>}
          <button className="rune-btn" disabled={changing || removing}>
            {changing ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
      <section
        id="settings-riot"
        className="rune-panel settings-section"
        data-reveal="up"
      >
        <h3>Conexión con Riot</h3>
        {unlinked && (
          <p className="text-teal" role="status">
            Cuenta de Riot desvinculada.
          </p>
        )}
        {account
          ? (
            <div className="settings-row">
              <div className="settings-linked">
                <span className="settings-status-dot" />
                <div>
                  <strong>{account.summonerName}#{account.tagLine}</strong>
                  <p className="page-sub">
                    {account.region} · Vinculada el{" "}
                    {new Date(account.linkedAt).toLocaleDateString("es", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <button
                className="btn-outline btn-danger"
                disabled={removing || changing}
                onClick={() => beginAction("unlink")}
              >
                Desvincular cuenta
              </button>
            </div>
          )
          : (
            <div className="settings-row">
              <p className="page-sub">
                Todavía no vinculaste una cuenta de Riot.
              </p>
              <Link className="rune-btn" href="/dashboard">
                Vincular cuenta
              </Link>
            </div>
          )}
      </section>
      <section
        className="rune-panel settings-section danger-zone"
        data-reveal="up"
      >
        <h3>Zona de peligro</h3>
        <div className="settings-row">
          <p className="page-sub">
            Eliminar tu cuenta borra tu perfil, historial guardado, debilidades
            y planes de entrenamiento de esta aplicación.
          </p>
          <button
            className="btn-outline btn-danger"
            disabled={changing || removing}
            onClick={() => beginAction("delete")}
          >
            Eliminar cuenta
          </button>
        </div>
      </section>
      {action && (
        <section
          className="rune-panel settings-section danger-zone"
          data-reveal="up"
          ref={confirmationRef}
          aria-labelledby="confirm-action-title"
        >
          <h3 id="confirm-action-title">
            {action === "delete"
              ? "Confirmar eliminación de cuenta"
              : "Confirmar desvinculación de Riot"}
          </h3>
          <p className="page-sub">
            {action === "delete"
              ? "Esta acción es permanente. Escribe ELIMINAR e ingresa tu contraseña para continuar."
              : "Se eliminarán las partidas guardadas, debilidades y planes asociados a Riot en esta aplicación. Tu cuenta de acceso se conserva y podrás vincular Riot otra vez."}
          </p>
          <form onSubmit={remove} className="settings-form">
            {action === "delete" && (
              <label className="field-label" htmlFor="delete-confirmation">
                Escribe ELIMINAR<input
                  id="delete-confirmation"
                  className="rune-field"
                  required
                  autoComplete="off"
                  value={confirmation}
                  onChange={(e) =>
                    setConfirmation(e.target.value)}
                />
              </label>
            )}
            <label className="field-label" htmlFor="confirmation-password">
              Tu contraseña<PasswordInput
                id="confirmation-password"
                className="rune-field"
                required
                autoComplete="current-password"
                value={confirmationPassword}
                onChange={(e) => setConfirmationPassword(e.target.value)}
              />
            </label>
            {removeError && (
              <p role="alert" className="text-ember">{removeError}</p>
            )}
            <div className="settings-confirm-actions">
              <button
                type="button"
                className="btn-outline"
                disabled={removing}
                onClick={() => setAction(null)}
              >
                Cancelar
              </button>
              <button
                className="btn-outline btn-danger"
                disabled={removing ||
                  (action === "delete" && confirmation !== "ELIMINAR")}
              >
                {removing
                  ? "Procesando…"
                  : action === "delete"
                  ? "Eliminar mi cuenta"
                  : "Desvincular Riot"}
              </button>
            </div>
          </form>
        </section>
      )}
    </ScrollRevealRoot>
  );
}
