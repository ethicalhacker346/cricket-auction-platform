// src/pages/EditPlayerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  ArrowLeft,
  Clock,
  CheckCircle2,
  User,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PlayerForm } from "@/components/player/PlayerForm";
import { LogoSelector } from "@/components/ui/LogoSelector";
import { LOGO_LIBRARY, type Logo } from "@/components/ui/logoLibrary";
import { usePlayerMe, useUpdatePlayerMe } from "@/hooks/usePlayers";
import type { PlayerFormValues } from "@/lib/validators/playerSchema";

export function EditPlayerPage() {
  const navigate = useNavigate();
  const { data: player, isLoading, error } = usePlayerMe();
  const { mutate: updatePlayer, isPending, isSuccess } = useUpdatePlayerMe();

  // Logo state
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [showLogoSelector, setShowLogoSelector] = useState(false);

  // LOGO_LIBRARY stores logos as root-relative paths (e.g.
  // "/logos/players/image1.png"), but both the Zod schema's
  // `profileImage: z.string().url()` check and the backend's Player.js
  // validator (`/^https?:\/\//`) require an *absolute* URL. Left as-is, the
  // hidden `profileImage` field in PlayerForm silently failed validation on
  // submit whenever a real logo was picked — react-hook-form just refused
  // to call onSubmit, with no visible error, which looked like a dead
  // "Save Changes" button. Resolving to an absolute URL fixes both layers.
  const toAbsoluteUrl = (url: string) => {
    if (!url) return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  };

  // LogoSelector's "clear" action calls onChange with an empty-but-truthy
  // Logo object ({ id: "", url: "", ... }), not null — normalize that here
  // too, same as CreatePlayerPage.
  const handleLogoChange = (logo: Logo) => {
    setSelectedLogo(logo.url ? { ...logo, url: toAbsoluteUrl(logo.url) } : null);
  };

  // Initialize logo from player data. `profileImage` is the backend field
  // name (see Player.js) — the form/UI shows it as a "logo" for player
  // profiles, but the wire format must match `profileImage` exactly or
  // updates silently get dropped by the service's field whitelist. The
  // saved value is always absolute (backend enforces http/https), so the
  // library lookup has to compare against absolute URLs too.
  useEffect(() => {
    if (player?.profileImage) {
      const found = LOGO_LIBRARY.find(
        (l) => toAbsoluteUrl(l.url) === player.profileImage
      );
      if (found) setSelectedLogo({ ...found, url: toAbsoluteUrl(found.url) });
    }
  }, [player?.profileImage]);

  // Form default values with logo
  const defaultValues = useMemo<Partial<PlayerFormValues>>(() => {
    if (!player) return {};
    return {
      fullName: player.fullName,
      dateOfBirth: player.dateOfBirth
        ? new Date(player.dateOfBirth).toISOString().split("T")[0]
        : "",
      nationality: player.nationality ?? "",
      primaryRole: player.primaryRole,
      battingStyle: player.battingStyle ?? "",
      bowlingStyle: player.bowlingStyle ?? "",
      profileImage: selectedLogo?.url || player.profileImage || "",
      bio: player.bio ?? "",
    };
  }, [player, selectedLogo]);

  const handleSubmit = (payload: Partial<PlayerFormValues>) => {
    updatePlayer({
      ...payload,
      profileImage: selectedLogo?.url || payload.profileImage,
    });
  };

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isPending]);

  // Auto-hide success toast
  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => {}, 3000);
      return () => clearTimeout(t);
    }
  }, [isSuccess]);

  if (isLoading) return <EditPageSkeleton />;
  if (error || !player) return <EditPageError />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════════════════════════════════════════════════════════════
          STICKY HEADER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3">
            {player.updatedAt && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Last updated {formatDistanceToNow(new Date(player.updatedAt))} ago
              </span>
            )}
            <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
              Active
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* ═══════════════════════════════════════════════════════════════
            PAGE TITLE
            ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Pencil className="w-5 h-5 text-indigo-500" />
              </div>
              Edit Profile
            </h1>
            <p className="text-slate-500 mt-1">
              Keep your cricket identity sharp and up to date.
            </p>
          </motion.div>

          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-100 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Saved successfully
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            IDENTITY CARD — Logo + Expandable selector
            ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden"
        >
          {/* Card header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <User className="w-4 h-4 text-indigo-500" />
              </div>
              <h2 className="font-semibold text-slate-800">Brand Identity</h2>
            </div>
            <button
              onClick={() => setShowLogoSelector((s) => !s)}
              className={`
                flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg
                ${showLogoSelector
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              {showLogoSelector ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Close Library
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  Change Logo
                </>
              )}
            </button>
          </div>

          {/* Logo display */}
          <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
            <motion.div
              layout
              className={`
                relative w-28 h-28 rounded-2xl flex items-center justify-center
                border-2 transition-all duration-300
                ${selectedLogo
                  ? "border-indigo-500/30 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg shadow-indigo-500/10"
                  : "border-slate-200 bg-slate-50"
                }
              `}
            >
              <AnimatePresence mode="wait">
                {selectedLogo ? (
                  <motion.img
                    key={selectedLogo.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    src={selectedLogo.url}
                    alt={selectedLogo.name}
                    className="w-20 h-20 object-contain"
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-1 text-slate-400"
                  >
                    <User className="w-8 h-8" />
                    <span className="text-[10px]">No logo</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {selectedLogo && (
                <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center shadow-md">
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              )}
            </motion.div>

            <div className="text-center sm:text-left flex-1">
              <h3 className="font-semibold text-slate-800 text-lg">
                {selectedLogo ? selectedLogo.name : "No Logo Selected"}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {selectedLogo
                  ? "This logo represents your player profile across all tournaments and auctions."
                  : "Choose a logo to build your brand identity on the platform."}
              </p>
              {selectedLogo && (
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {selectedLogo.url}
                </p>
              )}
            </div>
          </div>

          {/* Expandable Logo Selector — Dark section */}
          <AnimatePresence>
            {showLogoSelector && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-slate-100 bg-slate-900/95 backdrop-blur-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">
                        Player Logo Library
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLogoSelector(false)}
                      className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                  <LogoSelector
                    userRole="player"
                    value={selectedLogo?.url || null}
                    onChange={(logo) => {
                      handleLogoChange(logo);
                      setTimeout(() => setShowLogoSelector(false), 400);
                    }}
                    logos={LOGO_LIBRARY}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            FORM CARD
            ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-10"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Profile Details
              </h2>
              <p className="text-xs text-slate-400">
                Update your cricket statistics and bio
              </p>
            </div>
          </div>

          <PlayerForm
            mode="edit"
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isSubmitting={isPending}
            submitLabel="Save Changes"
            profileImage={selectedLogo?.url || null}
          />
        </motion.div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════

function EditPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-20 h-6 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-6 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 rounded" />
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 bg-slate-100 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 space-y-8 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR STATE
// ═══════════════════════════════════════════════════════════════════════════

function EditPageError() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">
          Failed to load profile
        </h2>
        <p className="text-slate-500">Please try refreshing the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}