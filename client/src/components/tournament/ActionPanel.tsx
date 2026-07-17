import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Pencil,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
  ChevronRight,
  Ban,
  Zap,
  UserCheck,
  Building2,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LifecycleActions } from "@/components/tournament/LifecycleActions";
import {
  useOpenPlayerRegistration,
  useOpenTeamRegistration,
} from "@/hooks/useTournaments";
import {
  useMyPlayerRegistration,
  useMyTeamRegistrations,
} from "@/hooks/useRegistration";
import { TEAM_STATUS_META } from "@/lib/constants/tournament";
import { formatCurrency } from "@/lib/format";
import type { Tournament } from "@/types/tournament";
import type { User } from "@/types/user";

/* ═════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═════════════════════════════════════════════════════════════════ */

function PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <Icon className="h-4 w-4 text-emerald-600" />
      {title}
    </h3>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      Checking registration status…
    </div>
  );
}

function ClosedState({ message }: { message: string }) {
  return (
    <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
      <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
      {message}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ORGANIZER PANEL
   ═════════════════════════════════════════════════════════════════ */

export function OrganizerPanel({ tournament, isOwner }: { tournament: Tournament; isOwner: boolean }) {
  const openPlayerReg = useOpenPlayerRegistration(tournament.id);
  const openTeamReg = useOpenTeamRegistration(tournament.id);

  if (!isOwner) return null;

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={Pencil} title="Organizer controls" />
        <Link to={`/tournaments/${tournament.id}/edit`}>
          <Button variant="outline" size="sm" className="!w-auto gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Player registration</p>
            <p className="text-xs text-slate-500">
              {tournament.playerRegistrationOpen ? "Currently open" : "Currently closed"}
            </p>
          </div>
          {tournament.playerRegistrationOpen ? (
            <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Open
            </Badge>
          ) : (
            <Button
              variant="subtle"
              size="sm"
              className="!w-auto"
              isLoading={openPlayerReg.isPending}
              onClick={() => openPlayerReg.mutate()}
            >
              Open
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Franchise registration</p>
            <p className="text-xs text-slate-500">
              {tournament.teamRegistrationOpen ? "Currently open" : "Currently closed"}
            </p>
          </div>
          {tournament.teamRegistrationOpen ? (
            <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Open
            </Badge>
          ) : (
            <Button
              variant="subtle"
              size="sm"
              className="!w-auto"
              isLoading={openTeamReg.isPending}
              onClick={() => openTeamReg.mutate()}
            >
              Open
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Lifecycle</p>
        <LifecycleActions tournament={tournament} />
      </div>
    </PanelCard>
  );
}

/* ═════════════════════════════════════════════════════════════════
   FRANCHISE PANEL
   ═════════════════════════════════════════════════════════════════ */

export function FranchisePanel({ tournament, user }: { tournament: Tournament; user: User }) {
  const {
    data: myTeams = [],
    isLoading,
    isError,
  } = useMyTeamRegistrations(tournament.id);

  const hasRegistered = myTeams.length > 0;

  // Can register if: registration is open AND (teamsCount is undefined OR less than max)
  const currentTeams = typeof tournament.teamsCount === "number" ? tournament.teamsCount : 0;
  const maxTeams = typeof tournament.maxTeams === "number" ? tournament.maxTeams : 8;
  const canRegister = tournament.teamRegistrationOpen && currentTeams < maxTeams;

  return (
    <PanelCard>
      <SectionTitle icon={Building2} title="Franchise registration" />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Could not check your registration status.
        </div>
      ) : hasRegistered ? (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3.5 space-y-2"
          >
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700">
                You have {myTeams.length} team{myTeams.length > 1 ? "s" : ""} registered
              </p>
            </div>
            {myTeams.map((team: any) => (
              <div
                key={team._id || team.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition-colors hover:border-slate-200"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{team.name}</p>
                  <p className="text-xs text-slate-500">
                    Purse: {formatCurrency(team.wallet?.initialBudget ?? 0, tournament.currency)}
                    {team.roster?.length > 0 && ` · Roster: ${team.roster.length} players`}
                  </p>
                </div>
                <Badge
                  className={
                    TEAM_STATUS_META[team.status]?.badge || "bg-slate-100 text-slate-600"
                  }
                >
                  {TEAM_STATUS_META[team.status]?.label || team.status}
                </Badge>
              </div>
            ))}
            {canRegister && (
              <Link to={`/tournaments/${tournament.id}/register-franchise`} className="block pt-1">
                <Button size="sm" variant="outline" className="!w-auto gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Register Another Team
                </Button>
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      ) : canRegister ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3.5">
          <p className="mb-3 text-sm text-slate-500">
            Register your franchise now to reserve a purse of{" "}
            <span className="font-semibold text-slate-700">
              {formatCurrency(tournament.defaultPurse, tournament.currency)}
            </span>{" "}
            for the auction.
          </p>
          <Link to={`/tournaments/${tournament.id}/register-franchise`}>
            <Button size="sm" className="!w-auto gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Register Franchise
            </Button>
          </Link>
        </motion.div>
      ) : (
        <ClosedState message="Franchise registration is not open yet. Check back soon." />
      )}

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
        Signed in as <span className="font-semibold text-slate-500">{user.name}</span>
      </p>
    </PanelCard>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PLAYER PANEL
   ═════════════════════════════════════════════════════════════════ */

export function PlayerPanel({ tournament, user }: { tournament: Tournament; user: User }) {
  const { data: myEntry, isLoading, isError } = useMyPlayerRegistration(tournament.id);

  // Defensive: treat any truthy object as registered
  const isRegistered = !!myEntry && typeof myEntry === "object";

  return (
    <PanelCard>
      <SectionTitle icon={Trophy} title="Player registration" />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Could not check your registration status.
        </div>
      ) : isRegistered ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3.5"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                <UserCheck className="h-4 w-4" />
                You&apos;re registered
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">
                Base price{" "}
                {typeof myEntry.basePrice === "number"
                  ? formatCurrency(myEntry.basePrice, tournament.currency)
                  : "N/A"}
                {myEntry.role && ` · ${myEntry.role}`}
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              {myEntry.status || "Pending"}
            </Badge>
          </div>

          {(myEntry.status === "PENDING" || myEntry.status === "DRAFT") && (
            <Link
              to={`/tournaments/${tournament.id}/register-player`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              <Pencil className="h-3 w-3" />
              Edit your registration
            </Link>
          )}
        </motion.div>
      ) : tournament.playerRegistrationOpen ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3.5">
          <p className="mb-3 text-sm text-slate-500">
            Put yourself up for auction — set your role and base price so franchises can bid for
            you.
          </p>
          <Link to={`/tournaments/${tournament.id}/register-player`}>
            <Button size="sm" className="!w-auto gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Register as Player
            </Button>
          </Link>
        </motion.div>
      ) : (
        <ClosedState message="Player registration is not open yet. Check back soon." />
      )}

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
        Signed in as <span className="font-semibold text-slate-500">{user.name}</span>
      </p>
    </PanelCard>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ADMIN NOTICE
   ═════════════════════════════════════════════════════════════════ */

export function AdminNotice() {
  return (
    <PanelCard className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
        <ShieldAlert className="h-5 w-5 text-violet-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">Administrator view</p>
        <p className="text-xs text-slate-500">
          You&apos;re viewing this tournament with full read-access.
        </p>
      </div>
    </PanelCard>
  );
}

/* ═════════════════════════════════════════════════════════════════
   GUEST NOTICE
   ═════════════════════════════════════════════════════════════════ */

export function GuestNotice({ tournament }: { tournament: Tournament }) {
  return (
    <PanelCard>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Users className="h-5 w-5 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Sign in to participate</p>
          <p className="text-xs text-slate-500">
            {tournament.playerRegistrationOpen
              ? "Player registration is open. Sign in to register."
              : tournament.teamRegistrationOpen
              ? "Franchise registration is open. Sign in to register."
              : "Registration will open soon. Sign in to get notified."}
          </p>
        </div>
      </div>
    </PanelCard>
  );
}