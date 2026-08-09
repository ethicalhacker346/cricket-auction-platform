import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, ShieldAlert, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TournamentForm } from "@/components/tournament/TournamentForm";
import { LifecycleActions } from "@/components/tournament/LifecycleActions";
import { useTournament, useUpdateTournament } from "@/hooks/useTournaments";
import { useAuthStore } from "@/store/authStore";
import type { TournamentFormValues } from "@/lib/validators/tournament";

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: tournament, isLoading } = useTournament(id);
  const updateTournament = useUpdateTournament(id ?? "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader backTo={`/tournaments/${id}`} backLabel="Tournament" />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader backTo="/dashboard" backLabel="Dashboard" />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <EmptyState icon={Trophy} title="Tournament not found" />
        </main>
      </div>
    );
  }

  const isOwner = user?.role === "ORGANIZER" && user.id === tournament.organizerId;

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader backTo={`/tournaments/${tournament.id}`} backLabel="Tournament" />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <EmptyState
            icon={ShieldAlert}
            title="You can't edit this tournament"
            description="Only the organizer who created this tournament can make changes to it."
          />
        </main>
      </div>
    );
  }

  function handleSubmit(values: TournamentFormValues) {
    updateTournament.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        season: values.season || undefined,
        venue: values.venue || undefined,
        logo: values.logo || undefined,
        registrationDeadline: values.registrationDeadline
          ? new Date(values.registrationDeadline).toISOString()
          : undefined,
        auctionDate: values.auctionDate ? new Date(values.auctionDate).toISOString() : undefined,
        maxTeams: values.maxTeams,
        squadSize: values.squadSize,
        defaultPurse: values.defaultPurse,
        minBidIncrement: values.minBidIncrement,
        lotTimerSeconds: values.lotTimerSeconds,
        currency: values.currency,
      },
      { onSuccess: () => navigate(`/tournaments/${id}`) }
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader backTo={`/tournaments/${tournament.id}`} backLabel="Tournament" />
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-md shadow-emerald-500/20">
              <Pencil className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Edit {tournament.name}</h1>
              <p className="text-sm text-slate-500">Update details, then manage lifecycle below.</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Lifecycle status</h3>
            <LifecycleActions tournament={tournament} />
          </div>

          <TournamentForm
            defaultValues={{
              name: tournament.name,
              slug: tournament.slug,
              description: tournament.description ?? "",
              season: tournament.season ?? "",
              venue: tournament.venue ?? "",
              logo: tournament.logo ?? "",
              registrationDeadline: tournament.registrationDeadline ?? "",
              auctionDate: tournament.auctionDate ?? "",
              maxTeams: tournament.maxTeams,
              squadSize: tournament.squadSize,
              defaultPurse: tournament.defaultPurse,
              minBidIncrement: tournament.minBidIncrement,
              lotTimerSeconds: tournament.lotTimerSeconds,
              currency: tournament.currency,
            }}
            onSubmit={handleSubmit}
            isSubmitting={updateTournament.isPending}
            submitLabel="Save changes"
            lockSlug
            tournamentId={tournament.id}
          />
        </motion.div>
      </main>
    </div>
  );
}