import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TournamentForm } from "@/components/tournament/TournamentForm";
import { useCreateTournament } from "@/hooks/useTournaments";
import type { TournamentFormValues } from "@/lib/validators/tournament";

const DEFAULTS: TournamentFormValues = {
  name: "",
  slug: "",
  description: "",
  season: "",
  venue: "",
  logo: "",
  registrationDeadline: "",
  auctionDate: "",
  maxTeams: 8,
  squadSize: 15,
  defaultPurse: 10_000_000,
  minBidIncrement: 50_000,
  lotTimerSeconds: 30,
  currency: "INR",
};

export default function CreateTournamentPage() {
  const navigate = useNavigate();
  const createTournament = useCreateTournament();

  function handleSubmit(values: TournamentFormValues) {
    createTournament.mutate(
      {
        ...values,
        description: values.description || undefined,
        season: values.season || undefined,
        venue: values.venue || undefined,
        registrationDeadline: values.registrationDeadline
          ? new Date(values.registrationDeadline).toISOString()
          : undefined,
        auctionDate: values.auctionDate ? new Date(values.auctionDate).toISOString() : undefined,
      },
      {
        onSuccess: (tournament) => navigate(`/tournaments/${tournament.id}`),
      }
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader backTo="/dashboard" backLabel="Dashboard" />
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-md shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Create a new tournament</h1>
              <p className="text-sm text-slate-500">
                It starts as a draft — open registrations whenever you're ready.
              </p>
            </div>
          </div>
          <TournamentForm
            defaultValues={DEFAULTS}
            onSubmit={handleSubmit}
            isSubmitting={createTournament.isPending}
            submitLabel="Create Tournament"
          />
        </motion.div>
      </main>
    </div>
  );
}