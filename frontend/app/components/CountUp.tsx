"use client";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";

export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  from = 0,
  durationMs = 1500,
  delayMs = 300,
  startOnView = false,
  useGrouping = false,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  from?: number;
  durationMs?: number;
  delayMs?: number;
  startOnView?: boolean;
  useGrouping?: boolean;
}) {
  const { ref, display } = useAnimatedNumber(value, {
    from,
    durationMs,
    delayMs,
    startOnView,
  });
  const format = (number: number) =>
    `${prefix}${
      useGrouping
        ? number.toLocaleString("es", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
        : number.toFixed(decimals)
    }${suffix}`;
  return (
    <span
      ref={ref}
      className="count-up-value"
      style={{
        minWidth: `${Math.max(format(value).length, format(from).length)}ch`,
      }}
    >
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}
