// src/pages/EditFranchisePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  ArrowLeft,
  Clock,
  CheckCircle2,
  ChevronDown,
  Building2,
  Plus,
  ImageIcon,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FranchiseForm } from "@/components/franchise/FranchiseForm";
import { LogoSelector } from "@/components/ui/LogoSelector";
import { LOGO_LIBRARY, type Logo } from "@/components/ui/logoLibrary";
import { useMyFranchises, useFranchiseById, useUpdateFranchise } from "@/hooks/useFranchise";
import type { FranchiseFormValues } from "@/lib/validators/franchiseSchema";

export function EditFranchisePage() {
  const navigate = useNavigate();
  const { data: myFranchisesData, isLoading: loadingList } = useMyFranchises({ limit: 20 });

  const franchises = myFranchisesData?.data ?? myFranchisesData?.franchises ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first franchise when list loads
  useEffect(() => {
    if (franchises.length > 0 && !selectedId) {
      setSelectedId(franchises[0].id);
    }
  }, [franchises, selectedId]);

  // Redirect if no franchises
  useEffect(() => {
    if (!loadingList && franchises.length === 0) {
      navigate("/franchises/create", { replace: true });
    }
  }, [loadingList, franchises.length, navigate]);

  const { data: franchise, isLoading: loadingDetail } = useFranchiseById(selectedId ?? "");

  const { mutate: updateFranchise, isPending, isSuccess } = useUpdateFranchise();

  // ═══════════════════════════════════════════════════════════════════════
  // Logo state
  // ═══════════════════════════════════════════════════════════════════════
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [showLogoSelector, setShowLogoSelector] = useState(false);

  // LOGO_LIBRARY stores logos as root-relative paths (e.g.
  // "/logos/franchises/apex.png"), but Franchise.js's Mongoose validator
  // requires an absolute http(s) URL, and so does the Zod schema's
  // `logo: z.string().url()` check. A hidden field failing that check
  // silently blocks the whole form submit with no visible error — resolve
  // to absolute at selection time to avoid that entirely.
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
  const handleLogoChange = (logo: Logo) => {
    setSelectedLogo(logo.url ? { ...logo, url: toAbsoluteUrl(logo.url) } : null);
  };

  // Initialize / reset logo whenever the selected franchise changes (either
  // on first load, or when switching franchises via the dropdown). Always
  // sets — including clearing to null — so a previous franchise's logo
  // selection can't leak into the next one. The saved value is always
  // absolute (backend enforces http/https), so the library lookup compares
  // against absolute URLs too.
  useEffect(() => {
    if (franchise?.logo) {
      const found = LOGO_LIBRARY.find((l) => toAbsoluteUrl(l.url) === franchise.logo);
      setSelectedLogo(found ? { ...found, url: toAbsoluteUrl(found.url) } : null);
    } else {
      setSelectedLogo(null);
    }
  }, [selectedId, franchise?.logo]);

  // Reset form values when selected franchise changes
  const defaultValues = useMemo<Partial<FranchiseFormValues>>(() => {
    if (!franchise) return {};
    return {
      name: franchise.name,
      slug: franchise.slug,
      logo: selectedLogo?.url || franchise.logo || "",
      city: franchise.city ?? "",
      description: franchise.description ?? "",
    };
  }, [franchise, selectedLogo]);

  const handleSubmit = (payload: Partial<FranchiseFormValues>) => {
    if (!selectedId) return;
    updateFranchise({
      id: selectedId,
      payload: {
        ...payload,
        logo: selectedLogo?.url || payload.logo,
      },
    });
  };

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPending) {
        e.preventDefault();
        (e as any).returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isPending]);

  if (loadingList) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 space-y-8 animate-pulse">
            <div className="h-8 w-48 bg-slate-200 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="h-12 bg-slate-100 rounded-xl" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const selectedFranchise = franchises.find((f) => f.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3">
            {selectedFranchise?.updatedAt && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Last updated {formatDistanceToNow(new Date(selectedFranchise.updatedAt))} ago
              </span>
            )}
            {selectedFranchise?.isActive && (
              <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                Active
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Title + Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-violet-500" />
              Edit Franchise
            </h1>
            <p className="text-slate-500 mt-1">
              Manage your team's public identity and branding.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isSuccess && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Saved successfully
              </div>
            )}

            {franchises.length > 1 && (
              <div className="relative">
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="appearance-none pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 cursor-pointer"
                >
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            <button
              onClick={() => navigate("/create-franchise")}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>

        {loadingDetail || !selectedId ? (
          <>
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
              <div className="h-8 w-1/3 bg-slate-100 rounded-lg" />
              <div className="h-12 bg-slate-100 rounded-xl" />
              <div className="h-12 bg-slate-100 rounded-xl" />
              <div className="h-32 bg-slate-100 rounded-xl" />
            </div>
          </>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════
                BRAND IDENTITY CARD — Logo + Expandable selector
                ═══════════════════════════════════════════════════════════ */}
            <motion.div
              key={`brand-${selectedId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden"
            >
              {/* Card header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-violet-50 rounded-lg">
                    <Building2 className="w-4 h-4 text-violet-500" />
                  </div>
                  <h2 className="font-semibold text-slate-800">Brand Identity</h2>
                </div>
                <button
                  onClick={() => setShowLogoSelector((s) => !s)}
                  className={`
                    flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg
                    ${showLogoSelector
                      ? "text-violet-600 bg-violet-50"
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
                      ? "border-violet-500/30 bg-gradient-to-br from-violet-50 to-sky-50 shadow-lg shadow-violet-500/10"
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
                        <Building2 className="w-8 h-8" />
                        <span className="text-[10px]">No logo</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {selectedLogo && (
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shadow-md">
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
                      ? "This logo represents your franchise across tournaments, auctions, and public listings."
                      : "Choose a logo to build your franchise's brand identity on the platform."}
                  </p>
                  {selectedLogo && (
                    <p className="text-xs text-slate-400 mt-1 font-mono truncate">
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
                            Franchise Logo Library
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
                        userRole="franchise_owner"
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

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-10">
              <FranchiseForm
                key={selectedId}
                mode="edit"
                defaultValues={defaultValues}
                onSubmit={handleSubmit}
                isSubmitting={isPending}
                submitLabel="Save Changes"
                logo={selectedLogo?.url || null}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}