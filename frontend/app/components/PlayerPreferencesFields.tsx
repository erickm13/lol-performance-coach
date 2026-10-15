"use client";
import Image from "next/image";
import { useId, useState } from "react";
import {
  AREAS,
  type PlayerPreferences,
  ROLES,
  UNIVERSITIES,
} from "../lib/player";
import { useChampionCatalog } from "../lib/useChampionCatalog";
export function PlayerPreferencesFields(
  { value, onChange }: {
    value: PlayerPreferences;
    onChange: (value: PlayerPreferences) => void;
  },
) {
  const [step, setStep] = useState(0);
  const { champions, version, error, retry } = useChampionCatalog();
  const id = useId();
  const patch = (changes: Partial<PlayerPreferences>) =>
    onChange({ ...value, ...changes });
  const toggle = (
    key: "improvementAreas" | "targetRoles",
    item: string,
    max: number,
  ) => {
    const list = value[key];
    if (!list.includes(item) && list.length >= max) return;
    patch({
      [key]: list.includes(item)
        ? list.filter((entry) => entry !== item)
        : [...list, item],
    });
  };
  return (
    <div className="player-preferences-fields">
      <nav className="profile-steps" aria-label="Pasos de tu perfil">
        {["Tu juego", "Tus objetivos", "Tu comunidad"].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <div className="profile-step-body">
          <p className="page-sub">
            Cuéntale al coach cómo juegas. Puedes completar o cambiar estas
            preferencias después.
          </p>
          <div className="profile-field-grid">
            {(["primaryRole", "secondaryRole"] as const).map((key) => (
              <label className="field-label" key={key}>
                {key === "primaryRole" ? "Línea principal" : "Línea secundaria"}
                <select
                  className="rune-field"
                  value={value[key] ?? ""}
                  onChange={(event) =>
                    patch({ [key]: event.target.value || null })}
                >
                  <option value="">Sin elegir</option>
                  {ROLES.map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                      disabled={role.id === value[
                        key === "primaryRole" ? "secondaryRole" : "primaryRole"
                      ]}
                    >
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="field-label">
            ¿Cómo describes tu experiencia?<select
              className="rune-field"
              value={value.experience ?? ""}
              onChange={(event) =>
                patch({ experience: event.target.value || null })}
            >
              <option value="">Sin elegir</option>
              <option value="beginner">Estoy aprendiendo las bases</option>
              <option value="intermediate">
                Conozco el juego y quiero mejorar mis decisiones
              </option>
              <option value="advanced">
                Tengo experiencia y busco pulir detalles
              </option>
            </select>
          </label>
          <div>
            <label className="field-label">
              Campeones habituales · hasta 12<select
                className="rune-field"
                value=""
                disabled={!champions.length || value.champions.length >= 12}
                onChange={(event) => {
                  if (
                    event.target.value &&
                    !value.champions.includes(event.target.value)
                  ) {
                    patch({
                      champions: [...value.champions, event.target.value],
                    });
                  }
                }}
              >
                <option value="">
                  {champions.length ? "Añadir campeón" : "Cargando campeones…"}
                </option>
                {champions.filter((item) => !value.champions.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
              </select>
            </label>
            <div className="profile-champion-chips">
              {value.champions.map((champion) => (
                <button
                  key={champion}
                  type="button"
                  className="profile-chip"
                  aria-label={`Quitar ${
                    champions.find((item) => item.id === champion)?.name ??
                      champion
                  }`}
                  onClick={() =>
                    patch({
                      champions: value.champions.filter((item) =>
                        item !== champion
                      ),
                    })}
                >
                  <Image
                    unoptimized
                    width={32}
                    height={32}
                    src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${
                      encodeURIComponent(champion)
                    }.png`}
                    alt=""
                  />
                  {champions.find((item) => item.id === champion)?.name ??
                    champion}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            {error && (
              <p className="page-sub" role="status">
                {error}{" "}
                <button type="button" className="rune-link" onClick={retry}>
                  Reintentar catálogo
                </button>
              </p>
            )}
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="profile-step-body">
          <fieldset>
            <legend>¿Qué quieres mejorar? · hasta 6 áreas</legend>
            <div className="profile-options">
              {AREAS.map((area) => (
                <label key={area.id}>
                  <input
                    type="checkbox"
                    checked={value.improvementAreas.includes(area.id)}
                    disabled={value.improvementAreas.length >= 6 &&
                      !value.improvementAreas.includes(area.id)}
                    onChange={() => toggle("improvementAreas", area.id, 6)}
                  />
                  {area.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>¿En qué líneas quieres progresar?</legend>
            <div className="profile-options">
              {ROLES.map((role) => (
                <label key={role.id}>
                  <input
                    type="checkbox"
                    checked={value.targetRoles.includes(role.id)}
                    onChange={() => toggle("targetRoles", role.id, 5)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field-label">
            Minutos disponibles para practicar por semana<input
              type="number"
              className="rune-field"
              min={15}
              max={10080}
              step={15}
              placeholder="Por ejemplo, 120"
              value={value.weeklyMinutes ?? ""}
              onChange={(event) =>
                patch({
                  weeklyMinutes: event.target.value === ""
                    ? null
                    : Number(event.target.value),
                })}
            />
          </label>
          <p className="page-sub">
            El coach adaptará el alcance de tus ejercicios a este tiempo.
          </p>
        </div>
      )}
      {step === 2 && (
        <div className="profile-step-body">
          <label className="field-label" htmlFor={`${id}-university`}>
            Universidad · opcional<input
              id={`${id}-university`}
              list={`${id}-universities`}
              className="rune-field"
              maxLength={120}
              value={value.universityName ?? ""}
              placeholder="No estudio / prefiero no indicarla"
              onChange={(event) =>
                patch({ universityName: event.target.value || null })}
            />
            <datalist id={`${id}-universities`}>
              {UNIVERSITIES.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <p className="page-sub">
            Elige una sugerencia o escribe otra universidad. Puedes dejarlo
            vacío. La afiliación es declarada por ti.
          </p>
          <label className="profile-consent">
            <input
              type="checkbox"
              checked={value.rankingVisible}
              onChange={(event) =>
                patch({ rankingVisible: event.target.checked })}
            />
            <span>
              Quiero aparecer en el ranking de la plataforma con mi Riot ID,
              rango oficial y universidad si la indico.
            </span>
          </label>
          <p className="page-sub">
            Tu correo y tus objetivos personales no se publican. Puedes retirar
            esta preferencia en cualquier momento. Para aparecer necesitas
            correo verificado y una cuenta clasificatoria vinculada.
          </p>
        </div>
      )}
      <div className="profile-step-actions">
        {step > 0 && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => setStep(step - 1)}
          >
            ← Anterior
          </button>
        )}
        {step < 2 && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => setStep(step + 1)}
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}
