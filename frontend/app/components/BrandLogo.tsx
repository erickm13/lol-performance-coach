import Image from "next/image";

const logos = {
  wordmark: {
    src: "/branding/diff-wordmark-dark-background.png",
    width: 810,
    height: 405,
  },
  symbol: {
    src: "/branding/diff-symbol-compact.png",
    width: 256,
    height: 256,
  },
} as const;

type BrandLogoProps = {
  variant: keyof typeof logos;
  mobileVariant?: keyof typeof logos;
};

export function BrandLogo({ variant, mobileVariant }: BrandLogoProps) {
  const logo = logos[variant];
  const mobileLogo = mobileVariant ? logos[mobileVariant] : undefined;
  const responsive = mobileVariant !== undefined;
  const wrapperClassName = responsive
    ? "brand-logo brand-logo--responsive"
    : variant === "wordmark"
    ? "brand-logo brand-logo--wordmark"
    : "brand-logo brand-logo--symbol";
  const imageClassName = variant === "wordmark"
    ? "brand-logo-image brand-logo-image--wordmark"
    : "brand-logo-image brand-logo-image--symbol";

  return (
    <span
      className={wrapperClassName}
      role="img"
      aria-label="Diff"
    >
      <Image
        className={`${imageClassName}${responsive ? " brand-logo-image--desktop" : ""}`}
        src={logo.src}
        width={logo.width}
        height={logo.height}
        sizes={variant === "symbol" ? "82px" : "270px"}
        alt=""
      />
      {mobileLogo && mobileVariant && (
        <Image
          className={`brand-logo-image ${mobileVariant === "wordmark" ? "brand-logo-image--wordmark" : "brand-logo-image--symbol"} brand-logo-image--mobile`}
          src={mobileLogo.src}
          width={mobileLogo.width}
          height={mobileLogo.height}
          sizes={mobileVariant === "symbol" ? "82px" : "270px"}
          alt=""
        />
      )}
    </span>
  );
}
