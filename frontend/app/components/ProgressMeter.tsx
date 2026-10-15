"use client";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";
export function ProgressMeter(
  { value, label }: { value: number; label: string },
) {
  const { ref, display } = useAnimatedNumber<HTMLDivElement>(value, {
    from: 100,
    startOnView: true,
    durationMs: 1200,
    delayMs: 120,
  });
  return (
    <div
      ref={ref}
      className="progress-track training-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="progress-fill"
        style={{ width: `${Math.max(0, Math.min(100, display))}%` }}
      />
    </div>
  );
}
