import { cn } from "@/utils/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 shadow-lg shadow-emerald-500/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-white"
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
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Gully<span className="text-emerald-600">Bid</span>
      </span>
    </div>
  );
}
