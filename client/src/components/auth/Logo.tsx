import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("group inline-flex items-center gap-2.5", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/20 transition-all duration-300 group-hover:shadow-emerald-500/40 group-hover:scale-105">
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="relative h-5 w-5 text-white"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20 15 9" />
          <circle cx="17.5" cy="6.5" r="2.5" />
          <path d="M2 22c1-2.5 3-4.5 4-5" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight text-slate-900 transition-colors duration-300 group-hover:text-slate-800">
        Gully<span className="text-emerald-600 transition-colors duration-300 group-hover:text-emerald-500">Bid</span>
      </span>
    </div>
  );
}