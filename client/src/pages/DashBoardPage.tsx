import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  CalendarCheck2,
  Trophy,
  Gavel,
  ShieldCheck,
  RefreshCw,
  X,
  Filter,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TournamentCardSkeleton } from "@/components/ui/Skeleton";
import { TournamentCard } from "@/components/dashboard/TournamentCard";
import { RoleHero } from "@/components/dashboard/heroes/RoleHero";
import { AccountCard } from "@/components/dashboard/AccountCard";
import { RoadmapCard } from "@/components/dashboard/RoadmapCard";
import { useAuthStore } from "@/store/authStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { useTournaments } from "@/hooks/useTournaments";
import { usePlayerMe } from "@/hooks/usePlayers";
import { useMyFranchises } from "@/hooks/useFranchise";
import { isOngoingStatus, isPastStatus } from "@/lib/constants/tournament";

/* ═════════════════════════════════════════════════════════════════
   THEME
   ═════════════════════════════════════════════════════════════════ */
const ROLE_GLOWS = {
  ADMIN: "bg-violet-500/10 text-violet-600 border-violet-200",
  ORGANIZER: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  FRANCHISE_OWNER: "bg-amber-500/10 text-amber-600 border-amber-200",
  PLAYER: "bg-sky-500/10 text-sky-600 border-sky-200",
} as const;

const getRoleGlow = (role?: string) =>
  ROLE_GLOWS[role as keyof typeof ROLE_GLOWS] ?? ROLE_GLOWS.PLAYER;

/* ═════════════════════════════════════════════════════════════════
   UTILS
   ═════════════════════════════════════════════════════════════════ */
function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ═════════════════════════════════════════════════════════════════
   VIEW MODE
   ═════════════════════════════════════════════════════════════════ */
type ViewMode = "all" | "live" | "ongoing" | "past" | "my-organized";

const VIEW_META: Record<
  ViewMode,
  { label: string; tab: "all" | "ongoing" | "past"; predicate?: (t: any, userId?: string) => boolean }
> = {
  all: { label: "All tournaments", tab: "all" },
  live: { label: "Live auctions", tab: "ongoing", predicate: (t) => t.status === "AUCTION_RUNNING" },
  ongoing: { label: "Ongoing", tab: "ongoing" },
  past: { label: "Completed", tab: "past" },
  "my-organized": { label: "Organized by you", tab: "ongoing", predicate: (t, uid) => t.organizerId === uid },
};

/* ═════════════════════════════════════════════════════════════════
   MOTION
   ═════════════════════════════════════════════════════════════════ */
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 14 } },
};

/* ═════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const storedUser = useAuthStore((s) => s.user);
  const { data: freshUser, isLoading: isUserLoading } = useCurrentUser();

  const [view, setView] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);

  const user = freshUser ?? storedUser;
  const roleGlow = getRoleGlow(user?.role);

  /* ── Role-aware profile data ── */
  const { data: playerProfile } = usePlayerMe();
  const { data: franchiseData } = useMyFranchises(
    { limit: 1 },
    { enabled: user?.role === "FRANCHISE_OWNER" || user?.role === "ADMIN" }
  );
  const myFranchise = franchiseData?.data?.[0];

  /* ── Sync store ── */
  useEffect(() => {
    if (freshUser && freshUser !== storedUser) {
      useAuthStore.getState().updateUser(freshUser);
    }
  }, [freshUser, storedUser]);

  /* ── Keyboard shortcut to focus search ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.getElementById("tournament-search");
        if (el && document.activeElement !== el) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Fetch tournaments ── */
  const {
    data: tournamentsResponse,
    isLoading: loadingTournaments,
    isError: tournamentsError,
    error: tournamentsErrorObj,
    refetch,
    isRefetching,
  } = useTournaments({ search: debouncedQuery });

  const tournaments = useMemo(() => {
    if (!tournamentsResponse) return [];
    const list = tournamentsResponse.data ?? [];
    return Array.isArray(list) ? list : [];
  }, [tournamentsResponse]);

  /* ── Derived lists ── */
  const ongoing = useMemo(
    () => tournaments.filter((t) => isOngoingStatus(t.status) && t.status !== "DRAFT"),
    [tournaments]
  );

  const ongoingWithDrafts = useMemo(() => {
    if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) return ongoing;
    return tournaments.filter(
      (t) => isOngoingStatus(t.status) && (t.status !== "DRAFT" || t.organizerId === user.id)
    );
  }, [tournaments, ongoing, user]);

  const past = useMemo(() => tournaments.filter((t) => isPastStatus(t.status)), [tournaments]);

  const myOrganized = useMemo(
    () => tournaments.filter((t) => t.organizerId === user?.id).length,
    [tournaments, user?.id]
  );

  const liveCount = useMemo(
    () => tournaments.filter((t) => t.status === "AUCTION_RUNNING").length,
    [tournaments]
  );

  const draftCount = useMemo(
    () => tournaments.filter((t) => t.status === "DRAFT" && t.organizerId === user?.id).length,
    [tournaments, user?.id]
  );

  /* ── List from view ── */
  const list = useMemo(() => {
    const meta = VIEW_META[view];
    const base = meta.tab === "past" ? past : meta.tab === "all" ? tournaments : ongoingWithDrafts;
    if (meta.predicate) {
      return base.filter((t) => meta.predicate!(t, user?.id));
    }
    return base;
  }, [view, tournaments, ongoingWithDrafts, past, user?.id]);

  const canCreate = user?.role === "ORGANIZER" || user?.role === "ADMIN";

  /* ── Handlers ── */
  const handleCreate = useCallback(() => navigate("/tournaments/create"), [navigate]);
  const handleViewChange = useCallback((mode: ViewMode) => setView(mode), []);
  const handleTabChange = useCallback((tabVal: string) => {
    const map: Record<string, ViewMode> = { all: "all", ongoing: "ongoing", past: "past" };
    setView(map[tabVal] ?? "all");
  }, []);
  const clearFilters = useCallback(() => setView("all"), []);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10 pt-2"
    >
      {/* ═══════ HERO ═══════ */}
      <motion.div variants={item}>
        <RoleHero
          user={user}
          playerProfile={playerProfile}
          franchise={myFranchise}
          organizerStats={{ created: myOrganized, drafts: draftCount, live: liveCount }}
        />
      </motion.div>

      {/* ═══════ STATS AS FILTERS ═══════ */}
      <motion.div variants={item}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total tournaments"
            value={tournaments.length}
            icon={Trophy}
            delay={0}
            onClick={() => handleViewChange("all")}
            active={view === "all"}
          />
          <StatCard
            label="Live auctions"
            value={liveCount}
            icon={Gavel}
            accent="bg-rose-50 text-rose-600 border-rose-100"
            delay={0.05}
            onClick={() => handleViewChange("live")}
            active={view === "live"}
          />
          <StatCard
            label={user?.role === "ORGANIZER" ? "Organized by you" : "Ongoing events"}
            value={user?.role === "ORGANIZER" ? myOrganized : ongoing.length}
            icon={CalendarCheck2}
            accent="bg-indigo-50 text-indigo-600 border-indigo-100"
            delay={0.1}
            onClick={() => handleViewChange(user?.role === "ORGANIZER" ? "my-organized" : "ongoing")}
            active={view === "ongoing" || (user?.role === "ORGANIZER" && view === "my-organized")}
          />
          <StatCard
            label="Completed"
            value={past.length}
            icon={ShieldCheck}
            accent="bg-emerald-50 text-emerald-600 border-emerald-100"
            delay={0.15}
            onClick={() => handleViewChange("past")}
            active={view === "past"}
          />
        </div>
      </motion.div>

      {/* ═══════ ACCOUNT + ROADMAP ═══════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <AccountCard
          user={user}
          isLoading={isUserLoading}
          roleGlow={roleGlow}
          myOrganized={myOrganized}
          draftCount={draftCount}
          liveCount={liveCount}
        />
        <RoadmapCard user={user} playerProfile={playerProfile} franchise={myFranchise} />
      </div>

      {/* ═══════ TOURNAMENTS ═══════ */}
      <motion.section variants={item} className="pt-2">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Tournaments</h2>
            <p className="mt-1 text-sm text-slate-500">
              {view === "all"
                ? "Browse every tournament on the platform."
                : view === "live"
                ? "Auctions happening right now."
                : view === "past"
                ? "Revisit completed seasons."
                : view === "my-organized"
                ? "Tournaments you created."
                : "Browse ongoing auctions or revisit completed seasons."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-slate-500"
              onClick={() => refetch()}
              isLoading={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canCreate && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleCreate}
                  className="!w-auto gap-2 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Active filter pill */}
        <AnimatePresence>
          {view !== "all" && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                <Filter className="h-3.5 w-3.5" />
                {VIEW_META[view].label}
                <button
                  onClick={clearFilters}
                  className="ml-1 rounded-full p-0.5 transition-colors hover:bg-emerald-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Tabs
            value={VIEW_META[view].tab}
            onChange={handleTabChange}
            items={[
              { value: "all", label: "All", count: tournaments.length },
              { value: "ongoing", label: "Ongoing", count: ongoingWithDrafts.length },
              { value: "past", label: "Completed", count: past.length },
            ]}
          />
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="tournament-search"
              placeholder="Search tournaments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 sm:block">
              /
            </kbd>
          </div>
        </div>

        {/* Error Banner */}
        {tournamentsError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
          >
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <h3 className="mt-2 text-sm font-semibold text-rose-700">Failed to load tournaments</h3>
            <p className="mt-1 text-xs text-rose-600">
              {tournamentsErrorObj instanceof Error
                ? tournamentsErrorObj.message
                : "Something went wrong. Please try again."}
            </p>
            <Button variant="outline" className="mt-3 !w-auto text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Retry
            </Button>
          </motion.div>
        )}

        {/* Grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {loadingTournaments && !tournamentsError ? (
              <>
                <TournamentCardSkeleton />
                <TournamentCardSkeleton />
                <TournamentCardSkeleton />
              </>
            ) : list.length > 0 ? (
              list.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 100 }}
                >
                  <TournamentCard tournament={t} user={user ?? null} delay={i * 0.04} />
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="sm:col-span-2 lg:col-span-3"
              >
                <EmptyState
                  icon={view === "past" ? Trophy : CalendarCheck2}
                  title={
                    view === "live"
                      ? "No live auctions"
                      : view === "past"
                      ? "No completed tournaments"
                      : view === "my-organized"
                      ? "No tournaments organized by you"
                      : "No tournaments found"
                  }
                  description={
                    view === "live"
                      ? "No auctions are running right now. Check back soon."
                      : view === "past"
                      ? "Once a tournament wraps up, it will show up here."
                      : view === "my-organized"
                      ? "Create your first tournament to see it here."
                      : canCreate
                      ? "Create your first tournament to start the auction pipeline."
                      : "Check back soon — new tournaments open for registration regularly."
                  }
                  action={
                    (view === "ongoing" || view === "all" || view === "my-organized") && canCreate ? (
                      <Button onClick={handleCreate} className="!w-auto gap-2">
                        <Plus className="h-4 w-4" />
                        Create Tournament
                      </Button>
                    ) : undefined
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer meta */}
        {!loadingTournaments && list.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center text-xs text-slate-400"
          >
            Showing {list.length} tournament{list.length !== 1 ? "s" : ""}
            {debouncedQuery && ` matching "${debouncedQuery}"`}
            {view !== "all" && ` • filtered by ${VIEW_META[view].label.toLowerCase()}`}
          </motion.p>
        )}
      </motion.section>
    </motion.div>
  );
}