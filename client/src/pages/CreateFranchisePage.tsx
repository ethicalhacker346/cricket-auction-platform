// src/pages/CreateFranchisePage.tsx
import { useEffect, useCallback, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Shield,
  CheckCircle2,
  ArrowDown,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { FranchiseForm } from "@/components/franchise/FranchiseForm";
import { LogoSelector } from "@/components/ui/LogoSelector";
import { LOGO_LIBRARY, type Logo } from "@/components/ui/logoLibrary";
import { useCreateFranchise, useMyFranchises } from "@/hooks/useFranchise";
import { useAuthStore } from "@/store/authStore";
import type { FranchiseFormValues } from "@/lib/validators/franchiseSchema";

export function CreateFranchisePage() {
  const navigate = useNavigate();
  const { mutate: createFranchise, isPending } = useCreateFranchise();
  const user = useAuthStore((s) => s.user);

  const isAuthorized = user?.role === "FRANCHISE_OWNER" || user?.role === "ADMIN";

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #1: Only fetch franchises if user is authorized
  // This prevents 403 errors and unnecessary API calls
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: myFranchises, isLoading: checkingFranchises, error: listError } = useMyFranchises(
    { limit: 1 },
    { enabled: isAuthorized } // Only run query if authorized
  );

  const franchises = myFranchises?.data ?? [];

  // If they already have a franchise, show a dismissible heads-up banner
  // instead of silently redirecting — the user may intentionally want to
  // create a second franchise.
  useEffect(() => {
    if (franchises.length > 0) {
      // Optionally redirect to their franchise dashboard
      // navigate(`/franchises/${franchises[0].id}`, { replace: true });
    }
  }, [franchises, navigate]);

  // Logo selection — Step 1 of the onboarding flow.
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // LOGO_LIBRARY stores logos as root-relative paths (e.g.
  // "/logos/franchises/apex.png"), but Franchise.js's Mongoose validator
  // requires an absolute http(s) URL, and so does the Zod schema's
  // `logo: z.string().url()` check. Resolve to absolute at selection time
  // so it survives both validation layers — this is the exact issue that
  // silently blocked the player "Create Profile" button before.
  const toAbsoluteUrl = (url: string) => {
    if (!url) return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  };

  // LogoSelector's "clear" action calls onChange with an empty-but-truthy
  // Logo object ({ id: "", url: "", ... }), not null — normalize that here.
  const handleLogoChange = useCallback((logo: Logo) => {
    setSelectedLogo(logo.url ? { ...logo, url: toAbsoluteUrl(logo.url) } : null);
  }, []);

  const handleContinue = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowForm(true);
      setIsAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #2: Use useCallback to prevent unnecessary re-renders of FranchiseForm
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleSubmit = useCallback(
    (payload: Partial<FranchiseFormValues>) => {
      createFranchise({
        ...payload,
        logo: selectedLogo?.url || payload.logo,
      } as FranchiseFormValues);
    },
    [createFranchise, selectedLogo]
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #3: Show loading skeleton only when actually checking
  // ═══════════════════════════════════════════════════════════════════════════════
  if (checkingFranchises) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-200 rounded-xl" />
          <div className="w-32 h-4 bg-slate-200 rounded" />
          <p className="text-sm text-slate-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════════════════════════════════════════════════════════════
          HERO HEADER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/40 via-slate-900/0 to-slate-900/0" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30" />

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500 origin-left"
        />

        <div className="relative max-w-5xl mx-auto px-6 py-5 md:py-5">
          <Link
            to="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-100 transition-colors hover:text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl border border-white/10">
              <Crown className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-[0.15em]">
              Franchise Onboarding
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
          >
            Register Your{" "}
            <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              Franchise
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl leading-relaxed"
          >
            Establish your team's identity, enter tournaments, and build your
            legacy in the auction arena.
          </motion.p>

          {isAuthorized && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-4 mt-10"
            >
              <StepBadge
                number={1}
                label="Choose Logo"
                active={!showForm}
                completed={!!selectedLogo}
              />
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <StepBadge
                number={2}
                label="Franchise Details"
                active={showForm}
                completed={false}
              />
            </motion.div>
          )}
        </div>
      </div>

      {!isAuthorized ? (
        <div className="max-w-4xl mx-auto px-6 -mt-6 pb-20">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-10">
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="p-4 bg-red-50 rounded-full">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Unauthorized</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                You need Franchise Owner or Admin privileges to create a franchise.
              </p>
              <p className="text-xs text-slate-400">
                Current role:{" "}
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {user?.role || "none"}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Heads-up if they already own a franchise — dismissible, not a redirect */}
          {franchises.length > 0 && !showForm && (
            <div className="max-w-5xl mx-auto px-6 pt-8">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl"
              >
                <Building2 className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-800">
                    You already own {franchises.length === 1 ? "a franchise" : `${franchises.length} franchises`}
                  </p>
                  <p className="text-xs text-violet-600 mt-1">
                    You can still register another one, or{" "}
                    <Link to="/franchises/{franchiseID}/edit" className="underline underline-offset-2 font-medium">
                      manage your existing franchise
                    </Link>{" "}
                    instead.
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {listError && !showForm && (
            <div className="max-w-5xl mx-auto px-6 pt-8">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Could not check existing franchises
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    You can still create a franchise, but we couldn't verify if you already have one.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 1: LOGO SELECTOR — Dark contrast section
              ═══════════════════════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {!showForm && (
              <motion.section
                key="logo-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="relative bg-slate-900 border-y border-slate-800 mt-8"
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

                <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
                  <div className="text-center mb-10">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-4"
                    >
                      <Shield className="w-4 h-4" />
                      Step 1 of 2
                    </motion.div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      Choose Your Franchise Logo
                    </h2>
                    <p className="text-slate-400 max-w-lg mx-auto">
                      Select a crest that represents your team. This will be visible
                      to players, organizers, and fans across the platform.
                    </p>
                  </div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <LogoSelector
                      userRole="franchise_owner"
                      value={selectedLogo?.url || null}
                      onChange={handleLogoChange}
                      logos={LOGO_LIBRARY}
                    />
                  </motion.div>

                  <AnimatePresence>
                    {selectedLogo && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
                      >
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">
                            Selected: {selectedLogo.name}
                          </span>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleContinue}
                          disabled={isAnimating}
                          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors shadow-lg shadow-white/10 disabled:opacity-70"
                        >
                          Continue to Details
                          <ArrowDown className="w-4 h-4" />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!selectedLogo && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={handleContinue}
                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4"
                      >
                        Skip for now — you can add a logo later
                      </button>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════════════════
              STEP 2: FORM — Light theme
              ═══════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showForm && (
              <motion.section
                key="form-section"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="max-w-4xl mx-auto px-6 py-12 md:py-16"
              >
                {selectedLogo && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 p-2 flex items-center justify-center shrink-0">
                      <img
                        src={selectedLogo.url}
                        alt={selectedLogo.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {selectedLogo.name}
                      </p>
                      <p className="text-xs text-slate-400">Your selected logo</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setSelectedLogo(null);
                      }}
                      className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
                    >
                      Change
                    </button>
                  </motion.div>
                )}

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-10">
                  {listError && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Could not check existing franchises
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          You can still create a franchise, but we couldn't verify if you already have one.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-8">
                    <Sparkles className="w-5 h-5 text-violet-500" />
                    <h2 className="text-lg font-semibold text-slate-800">
                      Franchise Details
                    </h2>
                  </div>
                  <FranchiseForm
                    mode="create"
                    onSubmit={handleSubmit}
                    isSubmitting={isPending}
                    submitLabel="Create Franchise"
                    logo={selectedLogo?.url || null}
                  />
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    Back to logo selection
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP BADGE
// ═══════════════════════════════════════════════════════════════════════════

function StepBadge({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      className={`
        flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
        ${
          completed
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : active
            ? "bg-white/10 text-white border border-white/20"
            : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
        }
      `}
    >
      <div
        className={`
          w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
          ${
            completed
              ? "bg-emerald-500 text-white"
              : active
              ? "bg-white text-slate-900"
              : "bg-slate-700 text-slate-500"
          }
        `}
      >
        {completed ? <CheckCircle2 className="w-3 h-3" /> : number}
      </div>
      {label}
    </div>
  );
}