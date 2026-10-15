"use client";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";
export function AnimatedDamageBar({ value }: { value: number }) {
  const { ref, display } = useAnimatedNumber<HTMLDivElement>(value, {
    from: 100,
    durationMs: 1200,
    delayMs: 180,
    startOnView: true,
  });
  return (
    <div ref={ref} className="damage-track" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, display))}%` }} />
    </div>
  );
}
