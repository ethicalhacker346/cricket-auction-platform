// src/pages/CreatePlayerPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Sparkles,
  ChevronRight,
  Shield,
  User,
  CheckCircle2,
  ArrowDown,
  ArrowLeft,
  Loader2,
  
} from "lucide-react";
import { PlayerForm } from "@/components/player/PlayerForm";
import { LogoSelector } from "@/components/ui/LogoSelector";
import { LOGO_LIBRARY, type Logo } from "@/components/ui/logoLibrary";
import { useCreatePlayer } from "@/hooks/usePlayers";
import { usePlayerMe } from "@/hooks/usePlayers";
import type { PlayerFormValues } from "@/lib/validators/playerSchema";
import { Link } from "react-router-dom";

export function CreatePlayerPage() {
  const navigate = useNavigate();
  const { mutate: createPlayer, isPending } = useCreatePlayer();
  const { data: existingPlayer, isLoading: checkingProfile } = usePlayerMe();

  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Redirect if profile exists
  useEffect(() => {
    if (existingPlayer) {
      navigate(`/players/${existingPlayer.id}/edit`, { replace: true });
    }
  }, [existingPlayer, navigate]);

  // LOGO_LIBRARY stores logos as root-relative paths (e.g.
  // "/logos/players/image1.png"), but both the Zod schema's
  // `profileImage: z.string().url()` check and the backend's Player.js
  // validator (`/^https?:\/\//`) require an *absolute* URL. Left as-is, the
  // hidden `profileImage` field in PlayerForm silently failed validation on
  // every submit — react-hook-form just refused to call onSubmit, with no
  // visible error anywhere, which looked exactly like a dead button.
  // Resolving to an absolute URL here fixes it for both validation layers.
  const toAbsoluteUrl = (url: string) => {
    if (!url) return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  };

  // LogoSelector's "clear" action calls onChange with an empty-but-truthy
  // Logo object ({ id: "", url: "", ... }), not null. Wiring onChange
  // straight to setSelectedLogo (as before) left selectedLogo truthy after
  // clearing, which broke the "completed" step badge and showed a blank
  // "Selected: " summary. Normalize that to a real null here.
  const handleLogoChange = (logo: Logo) => {
    setSelectedLogo(logo.url ? { ...logo, url: toAbsoluteUrl(logo.url) } : null);
  };

  const handleSubmit = (payload: Partial<PlayerFormValues>) => {
    createPlayer({
      ...payload,
      profileImage: selectedLogo?.url || payload.profileImage,
    } as PlayerFormValues);
  };

  const handleContinue = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowForm(true);
      setIsAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Checking profile...</span>
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
        
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/0 to-slate-900/0" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30" />

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-sky-500 origin-left"
          
        />
        

        <div className="relative max-w-5xl mx-auto px-6 py-2 md:py-5">
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
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-[0.15em]">
              Player Onboarding
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
          >
            Create Your{" "}
            <span className="bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 bg-clip-text text-transparent">
              Player Identity
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl leading-relaxed"
          >
            Choose your avatar and build your cricket profile to enter auctions,
            join tournaments, and get discovered by franchise owners.
          </motion.p>

          {/* Step indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4 mt-10"
          >
            <StepBadge
              number={1}
              label="Choose Avatar"
              active={!showForm}
              completed={!!selectedLogo}
            />
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <StepBadge
              number={2}
              label="Profile Details"
              active={showForm}
              completed={false}
            />
          </motion.div>
        </div>
      </div>

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
            className="relative bg-slate-900 border-y border-slate-800"
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

            <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4"
                >
                  <Shield className="w-4 h-4" />
                  Step 1 of 2
                </motion.div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Choose Your Avatar
                </h2>
                <p className="text-slate-400 max-w-lg mx-auto">
                  Select a logo that represents your playing style. This will be
                  visible to franchises and fans across the platform.
                </p>
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <LogoSelector
                  userRole="player"
                  value={selectedLogo?.url || null}
                  onChange={handleLogoChange}
                  logos={LOGO_LIBRARY}
                />
              </motion.div>

              {/* Selected summary + CTA */}
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
                      Continue to Profile
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
            {/* Logo reminder */}
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
                  <p className="text-xs text-slate-400">Your selected avatar</p>
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
              <div className="flex items-center gap-2 mb-8">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Profile Details
                  </h2>
                  <p className="text-xs text-slate-400">
                    Complete your cricket identity
                  </p>
                </div>
              </div>

              <PlayerForm
                mode="create"
                onSubmit={handleSubmit}
                isSubmitting={isPending}
                submitLabel="Create Profile"
                profileImage={selectedLogo?.url || null}
              />
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 mx-auto"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                Back to avatar selection
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
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