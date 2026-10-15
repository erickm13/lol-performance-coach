import type { ReactNode } from "react";

export function LearningIcon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    farming: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v10m3-8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9" />
      </>
    ),
    vision: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    early_game: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    consistency: (
      <>
        <path d="M4 4v16h16M7 15l4-5 4 2 5-7" />
      </>
    ),
    objectives: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    practice: (
      <>
        <path d="m13 2-9 12h7l-1 8 10-13h-7Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind] ?? paths.target}
    </svg>
  );
}
