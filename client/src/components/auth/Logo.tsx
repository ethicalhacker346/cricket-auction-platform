import { cn } from "@/utils/cn";

/** Inline brand identity stays visible even with blocked or offline images. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("gb-brand__mark", className)}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x=".5"
        y=".5"
        width="43"
        height="43"
        rx="13"
        fill="#161E1B"
        stroke="#D7B773"
        strokeOpacity=".4"
      />
      <g
        stroke="#E6C889"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m24 21-10.5 10.5a2.12 2.12 0 0 1-3-3L21 18M23 11l10 10M20 14l10 10M20 14l3-3M30 24l3-3M12 35h16" />
        <circle cx="33" cy="11" r="3.4" strokeWidth="1.4" />
        <path d="M31 8.4c2.2.7 3.5 2.5 3.6 4.8" strokeWidth=".9" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("gb-brand", `gb-brand--${tone}`, className)}>
      <BrandMark />
      <span className="gb-brand__type">
        <span className="gb-brand__name">
          Gully<span>Bid</span>
          <span className="gb-brand__period">.</span>
        </span>
        <span className="gb-brand__tagline">CRICKET AUCTION OS</span>
      </span>
    </span>
  );
}
