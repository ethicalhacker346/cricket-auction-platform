import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("group inline-flex items-center gap-2.5", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/20 transition-all duration-300 group-hover:shadow-emerald-500/40 group-hover:scale-105">
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Auction gavel — the head that strikes is picked out in gold, the
            same accent as "Gully" and the moment a bid closes: sold. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="relative h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Handle + grip */}
          <path
            d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381"
            stroke="currentColor"
            className="text-white"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Sounding block */}
          <path
            d="m8 8 6-6"
            stroke="currentColor"
            className="text-white"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m8.5 7.5 8 8"
            stroke="currentColor"
            className="text-white"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Striking head — the sale */}
          <path
            d="m16 16 6-6"
            stroke="#FCD34D"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m21.5 10.5-8-8"
            stroke="#FCD34D"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Impact flourish */}
          <path
            d="M18.3 6.7 20.1 5.1"
            stroke="#FCD34D"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <path
            d="M19.6 8.7 21.7 8"
            stroke="#FCD34D"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <span className="text-lg font-bold tracking-tight transition-colors duration-300">
        <span className="text-amber-700 group-hover:text-amber-600">Gully</span>
        <span className="text-emerald-600 transition-colors duration-300 group-hover:text-emerald-500">
          Bid
        </span>
      </span>
    </div>
  );
}