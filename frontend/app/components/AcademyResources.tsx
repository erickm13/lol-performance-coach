"use client";
import Image from "next/image";
import { type ReactNode, useRef, useState } from "react";
import type { AcademyResource } from "../lib/academy";
import {
  academyVideo,
  videoTime,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "../lib/academyVideo";

function PlayIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 4.5a1 1 0 0 1 1.5-.86l11 6.5a1 1 0 0 1 0 1.72l-11 6.5A1 1 0 0 1 8 17.5z" />
    </svg>
  );
}

function ResourceCard({ resource, playing, onPlay, onClose }: {
  resource: AcademyResource;
  playing: boolean;
  onPlay: () => void;
  onClose: () => void;
}) {
  const video = resource.kind === "video" ? academyVideo(resource.url) : null;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const playButton = useRef<HTMLButtonElement>(null);
  const watchUrl = video ? youtubeWatchUrl(video) : resource.url;
  return (
    <article
      className={`academy-resource${video ? " academy-video-card" : ""}`}
    >
      {video
        ? (
          <div className="academy-video-media">
            {playing
              ? (
                <iframe
                  key={`${privacy}:${attempt}`}
                  src={youtubeEmbedUrl(video, privacy, window.location.origin)}
                  title={`Reproducir ${resource.title}`}
                  width="640"
                  height="360"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )
              : (
                <button
                  type="button"
                  className="academy-video-preview"
                  ref={playButton}
                  onClick={onPlay}
                  aria-label={`Reproducir ${resource.title}${
                    video.start ? ` desde ${videoTime(video.start)}` : ""
                  }`}
                >
                  {!thumbnailFailed && (
                    <Image
                      unoptimized
                      fill
                      sizes="(max-width: 700px) 100vw, 50vw"
                      src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                      alt=""
                      onError={() => setThumbnailFailed(true)}
                    />
                  )}
                  <span className="academy-video-shade" aria-hidden="true" />
                  <span className="academy-video-provider" aria-hidden="true">
                    YouTube
                  </span>
                  <span className="academy-video-play" aria-hidden="true">
                    <PlayIcon />
                  </span>
                  <span className="academy-video-caption" aria-hidden="true">
                    Reproducir aquí
                  </span>
                  {video.start > 0 && (
                    <span className="academy-video-chapter" aria-hidden="true">
                      Desde {videoTime(video.start)}
                    </span>
                  )}
                </button>
              )}
          </div>
        )
        : (
          <div className="academy-resource-cover" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M12 5v15M3 4.5c4-1 6-.5 9 1.5 3-2 5-2.5 9-1.5V19c-4-1-6-.5-9 1.5C9 18.5 7 18 3 19Z" />
            </svg>
            <span>
              {resource.kind === "curso"
                ? "Aprende de profesionales"
                : "Lectura para tu práctica"}
            </span>
          </div>
        )}
      <div className="academy-resource-body">
        <span className="teaser-label">
          {resource.kind === "video"
            ? "Video"
            : resource.kind === "curso"
            ? "Curso"
            : "Lectura"} · {resource.language} ·{" "}
          {resource.year ?? "Fundamentos"}
        </span>
        <h4>{resource.title}</h4>
        <p className="academy-resource-author">{resource.author}</p>
        <p>{resource.focus}</p>
        <div className="academy-resource-actions">
          {video && playing && (
            <button
              type="button"
              className="rune-link"
              onClick={() => {
                onClose();
                requestAnimationFrame(() => playButton.current?.focus());
              }}
            >
              Cerrar reproductor
            </button>
          )}
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rune-link"
          >
            {video ? "Ver en YouTube" : `Abrir ${resource.kind}`} ↗
          </a>
        </div>
        {video && playing && (
          <details className="academy-video-help">
            <summary>¿YouTube pide iniciar sesión o no reproduce?</summary>
            <p>
              La verificación la gestiona YouTube. Abre este video con el enlace
              de abajo, resuelve allí el aviso y después vuelve a reintentar
              aquí. El acceso puede seguir bloqueado según tu navegador o red.
            </p>
            <div className="academy-resource-actions">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rune-link"
              >
                Abrir este video en YouTube ↗
              </a>
              <button
                type="button"
                className="rune-link"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Ya lo abrí · Reintentar aquí
              </button>
              <button
                type="button"
                className="rune-link"
                onClick={() => {
                  setPrivacy((value) => !value);
                  setAttempt((value) => value + 1);
                }}
              >
                {privacy
                  ? "Probar reproductor estándar"
                  : "Probar con privacidad mejorada"}
              </button>
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

export function AcademyResources(
  { resources, children }: {
    resources: AcademyResource[];
    children?: ReactNode;
  },
) {
  const [active, setActive] = useState<string | null>(null);
  const videoCount =
    resources.filter((resource) =>
      resource.kind === "video" && academyVideo(resource.url)
    ).length;
  return (
    <div className="section-body resource-grid">
      <p className="academy-resource-count">
        {videoCount}{" "}
        {videoCount === 1 ? "video disponible" : "videos disponibles"}
        {resources.length > videoCount
          ? ` · ${resources.length - videoCount} recursos adicionales`
          : ""}
      </p>
      {resources.map((resource) => (
        <ResourceCard
          key={resource.url}
          resource={resource}
          playing={active === resource.url}
          onPlay={() => setActive(resource.url)}
          onClose={() => setActive(null)}
        />
      ))}
      {children}
    </div>
  );
}
