"use client";
import Image from "next/image";
import { useId } from "react";

export function RankEmblem({ tier, label }: { tier: string; label: string }) {
  const id = useId().replace(/:/g, "");
  const outlineId = `rank-outline-${id}`;
  const maskId = `rank-mask-${id}`;
  const src = `/ranks/${tier.toLowerCase()}.png`;
  return (
    <>
      <Image
        src={src}
        alt={label}
        width={170}
        height={170}
        className="rank-emblem"
      />
      <svg
        className="rank-emblem-trace"
        viewBox="0 0 170 170"
        width="170"
        height="170"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id={outlineId}
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius="0.85"
              result="outer"
            />
            <feMorphology
              in="SourceAlpha"
              operator="erode"
              radius="0.55"
              result="inner"
            />
            <feComposite in="outer" in2="inner" operator="out" />
          </filter>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="170"
            height="170"
            style={{ maskType: "alpha" }}
          >
            <image
              href={src}
              width="170"
              height="170"
              preserveAspectRatio="xMidYMid meet"
              filter={`url(#${outlineId})`}
            />
          </mask>
        </defs>
        {/* Only the thin PNG silhouette receives the moving beam. */}
        <g mask={`url(#${maskId})`}>
          <foreignObject
            x="-85"
            y="-85"
            width="340"
            height="340"
            className="rank-emblem-light-rotor"
          >
            <div className="rank-emblem-light-beam" />
          </foreignObject>
        </g>
      </svg>
    </>
  );
}
