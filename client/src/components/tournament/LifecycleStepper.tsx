import { Check, X } from "lucide-react";
import { LIFECYCLE_STEPS, STATUS_META } from "@/lib/constants/tournament";
import type { TournamentStatus } from "@/types/tournament";
import { cn } from "@/utils/cn";

export function LifecycleStepper({ status }: { status: TournamentStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        <X className="h-4 w-4" />
        This tournament was cancelled before completion.
      </div>
    );
  }

  const effectiveStatus = status === "AUCTION_PAUSED" ? "AUCTION_LIVE" : status;
  const currentIndex = LIFECYCLE_STEPS.indexOf(effectiveStatus);

  return (
    <div className="flex w-full items-center">
      {LIFECYCLE_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const isLast = index === LIFECYCLE_STEPS.length - 1;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  current && "border-emerald-500 bg-white text-emerald-600 ring-4 ring-emerald-100",
                  !done && !current && "border-slate-200 bg-white text-slate-400"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "max-w-[84px] text-center text-[11px] font-semibold leading-tight",
                  current ? "text-emerald-700" : done ? "text-slate-600" : "text-slate-400"
                )}
              >
                {step === "AUCTION_LIVE" && status === "AUCTION_PAUSED" ? "Auction Paused" : STATUS_META[step].label}
              </span>
            </div>
            {!isLast && (
              <div className={cn("mx-1.5 h-0.5 flex-1 rounded-full", done ? "bg-emerald-500" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
