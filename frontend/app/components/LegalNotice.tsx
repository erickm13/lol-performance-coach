"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/useResource";

// Riot's developer policy and "Legal Jibber Jabber" policy both require this
// notice to stay visible to players; the English originals are kept verbatim.
export function LegalNoticeText() {
  return (
    <>
      <p>
        Diff no está respaldado por Riot Games y no refleja las opiniones de
        Riot Games ni de nadie oficialmente involucrado en la producción o
        gestión de las propiedades de Riot Games. Riot Games y todas las
        propiedades asociadas son marcas comerciales o marcas registradas de
        Riot Games, Inc.
      </p>
      <p>
        Diff se creó bajo la política «Legal Jibber Jabber» de Riot Games usando
        recursos propiedad de Riot Games. Riot Games no respalda ni patrocina
        este proyecto.
      </p>
      <p className="legal-original" lang="en">
        Diff isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the
        views or opinions of Riot Games or anyone officially involved in
        producing or managing Riot Games properties. Riot Games, and all
        associated properties are trademarks or registered trademarks of Riot
        Games, Inc. Diff was created under Riot Games&apos; &quot;Legal Jibber
        Jabber&quot; policy using assets owned by Riot Games. Riot Games does
        not endorse or sponsor this project.
      </p>
    </>
  );
}

export function LegalFooter() {
  return (
    <footer className="legal-footer">
      Diff no está respaldado por Riot Games.{" "}
      <Link href="/aviso-legal">Aviso legal</Link>
    </footer>
  );
}

export function LegalNoticeModal({ onAccepted }: { onAccepted: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/auth/legal-notice", { method: "POST" });
      onAccepted();
    } catch {
      setError("No pudimos guardar tu confirmación. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="legal-modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="rune-panel legal-modal"
      >
        <span className="teaser-label">ANTES DE EMPEZAR</span>
        <h2 id="legal-modal-title">Aviso legal</h2>
        <LegalNoticeText />
        {error && <p role="alert" className="legal-modal-error">{error}</p>}
        <button
          ref={button}
          type="button"
          className="rune-btn"
          disabled={saving}
          onClick={accept}
        >
          {saving ? "Guardando…" : "Entendido"}
        </button>
      </section>
    </div>
  );
}
