import { format } from "date-fns";
import { Banknote, CalendarClock, Gavel, Layers, Timer, Trophy, Users } from "lucide-react";
import { LifecycleStepper } from "./LifecycleStepper";
import { formatCurrency } from "@/lib/format";
import type { Tournament } from "@/types/tournament";

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="text-sm font-semibold text-slate-800">{value}</dd>
      </div>
    </div>
  );
}

export function OverviewTab({ tournament }: { tournament: Tournament }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Tournament lifecycle</h3>
        <div className="mt-6">
          <LifecycleStepper status={tournament.status} />
        </div>
      </div>

      {tournament.description && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">About this tournament</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{tournament.description}</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Auction &amp; roster details</h3>
        <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem icon={Users} label="Max Franchises" value={`${tournament.maxTeams} teams`} />
          <DetailItem icon={Trophy} label="Squad Size" value={`${tournament.squadSize} players / team`} />
          <DetailItem
            icon={Banknote}
            label="Purse per franchise"
            value={formatCurrency(tournament.defaultPurse, tournament.currency)}
          />
          <DetailItem
            icon={Layers}
            label="Minimum bid increment"
            value={formatCurrency(tournament.minBidIncrement, tournament.currency)}
          />
          <DetailItem icon={Timer} label="Lot timer" value={`${tournament.lotTimerSeconds} seconds`} />
          <DetailItem
            icon={CalendarClock}
            label="Registration deadline"
            value={tournament.registrationDeadline ? format(new Date(tournament.registrationDeadline), "d MMM yyyy") : "Not set"}
          />
          <DetailItem
            icon={Gavel}
            label="Auction date"
            value={tournament.auctionDate ? format(new Date(tournament.auctionDate), "d MMM yyyy") : "Not set"}
          />
        </dl>
      </div>
    </div>
  );
}