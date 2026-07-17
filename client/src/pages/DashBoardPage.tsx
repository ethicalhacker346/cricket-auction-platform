import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Gavel,
  Users,
  Trophy,
  Clock,
  Plus,
  Search,
  CalendarCheck2,
  Sparkles,
  TrendingUp,
  Activity,
  ChevronRight,
  AlertCircle,
  Zap,
  RefreshCw,
  X,
  Filter,
} from "lucide-react";
import { Logo } from "@/components/auth/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TournamentCardSkeleton } from "@/components/ui/Skeleton";
import { TournamentCard } from "@/components/dashboard/TournamentCard";
import { RoleChip } from "@/components/dashboard/RoleChip";
import { useAuthStore } from "@/store/authStore";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useTournaments } from "@/hooks/useTournaments";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { isOngoingStatus, isPastStatus } from "@/lib/constants/tournament";

/* ═════════════════════════════════════════════════════════════════
   THEME MAP
   ═════════════════════════════════════════════════════════════════ */
const ROLE_ICONS = {
  ADMIN: ShieldCheck,
  ORGANIZER: Gavel,
  FRANCHISE_OWNER: Users,
  PLAYER: Trophy,
} as const;

const ROLE_GRADIENTS = {
  ADMIN: "from-violet-600 via-purple-600 to-fuchsia-700",
  ORGANIZER: "from-emerald-600 via-teal-600 to-cyan-700",
  FRANCHISE_OWNER: "from-amber-500 via-orange-500 to-rose-600",
  PLAYER: "from-sky-500 via-blue-600 to-indigo-700",
} as const;

const ROLE_GLOWS = {
  ADMIN: "bg-violet-500/10 text-violet-600 border-violet-200",
  ORGANIZER: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  FRANCHISE_OWNER: "bg-amber-500/10 text-amber-600 border-amber-200",
  PLAYER: "bg-sky-500/10 text-sky-600 border-sky-200",
} as const;

const getRoleIcon = (role?: string) =>
  (role ? ROLE_ICONS[role as keyof typeof ROLE_ICONS] : null) ?? Trophy;

const getRoleGradient = (role?: string) =>
  ROLE_GRADIENTS[role as keyof typeof ROLE_GRADIENTS] ?? ROLE_GRADIENTS.PLAYER;

const getRoleGlow = (role?: string) =>
  ROLE_GLOWS[role as keyof typeof ROLE_GLOWS] ?? ROLE_GLOWS.PLAYER;

/* ═════════════════════════════════════════════════════════════════
   UTILS
   ═════════════════════════════════════════════════════════════════ */
const formatMemberSince = (date?: string | Date | null): string => {
  if (!date) return "—";
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return "—";
    return format(parsed, "d MMM yyyy");
  } catch {
    return "—";
  }
};

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
   DASHBOARD
   ═════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const storedUser = useAuthStore((s) => s.user);
  const { data: freshUser, isLoading: isUserLoading } = useCurrentUser();
  const logout = useLogout();

  const [view, setView] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [isScrolled, setIsScrolled] = useState(false);

  const user = freshUser ?? storedUser;
  const RoleIcon = getRoleIcon(user?.role);
  const roleGradient = getRoleGradient(user?.role);
  const roleGlow = getRoleGlow(user?.role);

  /* ── Scroll ── */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Sync store ── */
  useEffect(() => {
    if (freshUser && freshUser !== storedUser) {
      useAuthStore.getState().updateUser(freshUser);
    }
  }, [freshUser, storedUser]);

  /* ── Keyboard / to focus search ── */
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

  /* ── Fetch ── */
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

  const handleViewChange = useCallback((mode: ViewMode) => {
    setView(mode);
  }, []);

  const handleTabChange = useCallback((tabVal: string) => {
    const map: Record<string, ViewMode> = {
      all: "all",
      ongoing: "ongoing",
      past: "past",
    };
    setView(map[tabVal] ?? "all");
  }, []);

  const clearFilters = useCallback(() => setView("all"), []);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* ═══════ HEADER ═══════ */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-2xl"
            : "border-b border-transparent bg-white/60 backdrop-blur-xl"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <RoleChip />
            <Button
              variant="ghost"
              className="!w-auto gap-2 px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:px-4"
              onClick={() => logout.mutate()}
              isLoading={logout.isPending}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <motion.div variants={container} initial="hidden" animate="visible" className="space-y-8">
          {/* ═══════ HERO ═══════ */}
          <motion.div
            variants={item}
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${roleGradient} p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10`}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute right-1/4 top-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            </div>

            <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex-1">
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 text-sm font-medium text-white/80"
                >
                  {isUserLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                      Syncing your profile…
                    </span>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-white/70" />
                      Welcome back
                    </>
                  )}
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, type: "spring" }}
                  className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
                >
                  {user?.name ?? "Guest"}
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-sm font-semibold text-white/95 backdrop-blur-md transition-all hover:bg-white/25"
                >
                  <RoleIcon className="h-4 w-4" />
                  {user?.role ? ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] : "—"}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl font-bold shadow-inner backdrop-blur-md ring-1 ring-white/30 sm:h-24 sm:w-24 sm:text-4xl"
              >
                {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </motion.div>
            </div>
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
                onClick={() =>
                  handleViewChange(user?.role === "ORGANIZER" ? "my-organized" : "ongoing")
                }
                active={
                  view === "ongoing" || (user?.role === "ORGANIZER" && view === "my-organized")
                }
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

          {/* ═══════ ACCOUNT + WHAT'S NEXT ═══════ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <motion.div
              variants={item}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md lg:col-span-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Account details</h2>
                {isUserLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Updating…
                  </span>
                )}
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[
                  { icon: Mail, label: "Email", value: user?.email ?? "—" },
                  {
                    icon: Phone,
                    label: "Phone",
                    value: user?.phone?.trim() ? user.phone : "Not provided",
                  },
                  {
                    icon: ShieldCheck,
                    label: "Status",
                    value: user?.isActive ? "Active" : "Inactive",
                    valueClass: user?.isActive ? "text-emerald-600" : "text-slate-400",
                  },
                  { icon: Clock, label: "Member since", value: formatMemberSince(user?.createdAt) },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${roleGlow} transition-transform group-hover:scale-105`}
                    >
                      <field.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {field.label}
                      </dt>
                      <dd
                        className={`mt-0.5 truncate text-sm font-medium text-slate-800 ${field.valueClass ?? ""}`}
                      >
                        {field.value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              {user?.role === "ORGANIZER" && (
                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Organizer snapshot
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-4">
                    {[
                      { label: "Created", value: myOrganized },
                      { label: "Drafts", value: draftCount },
                      { label: "Live now", value: liveCount },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div className="text-xl font-bold text-slate-900">{s.value}</div>
                        <div className="text-xs text-slate-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              variants={item}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md lg:col-span-2"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </span>
                What&apos;s next
              </h2>
              <ul className="mt-5 space-y-3">
                <AnimatePresence mode="popLayout">
                  {user?.role === "ORGANIZER" && (
                    <>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Create a tournament</p>
                          <p className="text-xs text-slate-500">Set up registration and auction pipeline.</p>
                        </div>
                      </motion.li>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Approve franchises</p>
                          <p className="text-xs text-slate-500">Lock the auction pool before bidding starts.</p>
                        </div>
                      </motion.li>
                    </>
                  )}
                  {user?.role === "FRANCHISE_OWNER" && (
                    <>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Register your franchise</p>
                          <p className="text-xs text-slate-500">Join an ongoing tournament.</p>
                        </div>
                      </motion.li>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Track approval</p>
                          <p className="text-xs text-slate-500">Get ready before auction day.</p>
                        </div>
                      </motion.li>
                    </>
                  )}
                  {user?.role === "PLAYER" && (
                    <>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500 ring-4 ring-sky-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Register as a player</p>
                          <p className="text-xs text-slate-500">Enter an ongoing tournament.</p>
                        </div>
                      </motion.li>
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500 ring-4 ring-sky-500/20" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Set your profile</p>
                          <p className="text-xs text-slate-500">Role and base price help teams discover you.</p>
                        </div>
                      </motion.li>
                    </>
                  )}
                  {user?.role === "ADMIN" && (
                    <motion.li
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-4 ring-violet-500/20" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Monitor platform</p>
                        <p className="text-xs text-slate-500">Oversee every tournament and auction.</p>
                      </div>
                    </motion.li>
                  )}
                  <motion.li
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400 ring-4 ring-slate-400/20" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Explore auctions</p>
                      <p className="text-xs text-slate-500">Browse live and upcoming events below.</p>
                    </div>
                  </motion.li>
                </AnimatePresence>
              </ul>
            </motion.div>
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
      </main>
    </div>
  );
}