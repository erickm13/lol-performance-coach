"use client";
import { useEffect, useRef, useState } from "react";
import { observeVisibleOnce } from "./observeVisible";

export function useAnimatedNumber<T extends HTMLElement = HTMLSpanElement>(
  value: number,
  { from = 0, durationMs = 1500, delayMs = 300, startOnView = false }: {
    from?: number;
    durationMs?: number;
    delayMs?: number;
    startOnView?: boolean;
  } = {},
) {
  const ref = useRef<T>(null);
  const [display, setDisplay] = useState(from);
  const current = useRef(from);
  const started = useRef(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = !startOnView;
    let cancelled = false;
    const update = (next: number) => {
      current.current = next;
      setDisplay(next);
    };
    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    const play = () => {
      cancel();
      if (cancelled) return;
      if (preference.matches || durationMs <= 0) {
        update(value);
        started.current = true;
        return;
      }
      // New data glides from the currently displayed value; a progressive
      // analysis update never flashes its completed count back to zero.
      const origin = started.current ? current.current : from;
      update(origin);
      if (origin === value) return;
      started.current = true;
      let began: number | null = null;
      timer = setTimeout(() => {
        const step = (now: number) => {
          if (cancelled) return;
          began ??= now;
          const progress = Math.min(1, (now - began) / Math.max(1, durationMs));
          const eased = 1 - (1 - progress) ** 3;
          update(progress === 1 ? value : origin + (value - origin) * eased);
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      }, Math.max(0, delayMs));
    };
    let stopObserving = () => {};
    if (startOnView && ref.current) {
      stopObserving = observeVisibleOnce(ref.current, () => {
        visible = true;
        play();
      });
    } else play();
    if (preference.matches) update(value);
    const changePreference = () => {
      cancel();
      if (preference.matches) {
        update(value);
        started.current = true;
      } else if (visible) play();
    };
    preference.addEventListener("change", changePreference);
    return () => {
      cancelled = true;
      cancel();
      stopObserving();
      preference.removeEventListener("change", changePreference);
    };
  }, [value, from, durationMs, delayMs, startOnView]);
  return { ref, display };
}
