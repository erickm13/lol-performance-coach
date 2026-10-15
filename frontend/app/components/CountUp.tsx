"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  durationMs = 1500,
  delayMs = 300,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  delayMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    let startTime: number | null = null;
    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, delayMs]);

  return (
    <>
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}
