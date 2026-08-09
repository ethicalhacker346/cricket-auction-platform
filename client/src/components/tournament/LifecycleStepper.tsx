import { Check, X } from "lucide-react";
import { LIFECYCLE_STEPS, STATUS_META } from "@/lib/constants/tournament";
import type { TournamentStatus } from "@/types/tournament";
import { cn } from "@/utils/cn";

export function LifecycleStepper({ status }: { status: TournamentStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        <X className="mt-0.5 h-4 w-4 shrink-0" />
        <span>This tournament was cancelled before completion.</span>
      </div>
    );
  }

  const effectiveStatus = status === "AUCTION_PAUSED" ? "AUCTION_LIVE" : status;
  const currentIndex = LIFECYCLE_STEPS.indexOf(effectiveStatus);

  return (
    <div
      className={cn(
        "w-full overflow-x-auto",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:overflow-visible"
      )}
    >
      <div className="flex min-w-max items-center sm:min-w-0 sm:w-full">
        {LIFECYCLE_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          const isLast = index === LIFECYCLE_STEPS.length - 1;
          return (
            <div
              key={step}
              className="flex shrink-0 items-center sm:flex-1 sm:shrink last:flex-none sm:last:flex-none"
            >
              <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-auto">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    done && "border-emerald-500 bg-emerald-500 text-white",
                    current && "border-emerald-500 bg-white text-emerald-600 ring-4 ring-emerald-100",
                    !done && !current && "border-slate-200 bg-white text-slate-400"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    "max-w-[72px] text-center text-[11px] font-semibold leading-tight sm:max-w-[84px]",
                    current ? "text-emerald-700" : done ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  {step === "AUCTION_LIVE" && status === "AUCTION_PAUSED" ? "Auction Paused" : STATUS_META[step].label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1.5 h-0.5 w-8 shrink-0 rounded-full sm:w-auto sm:flex-1",
                    done ? "bg-emerald-500" : "bg-slate-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}