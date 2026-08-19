import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  Edit3,
  ArrowRight,
  PlusCircle,
  Copy,
  Check,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBadge, StatPill, getRoleGradient } from "./shared";

/* ═════════════════════════════════════════════════════════════════
   TYPES
   A franchise owner can own MORE THAN ONE franchise (see useMyFranchises /
   EditFranchisePage, which already lists + switches between many). This
   component is built around a list, not a single record.
   ═════════════════════════════════════════════════════════════════ */
interface FranchiseLike {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  city?: string | null;
  isActive?: boolean;
  colorFrom?: string | null;
  colorTo?: string | null;
  description?: string | null;
  createdAt?: string;
}

interface FranchiseHeroProps {
  user: any;
  /** Preferred. Full list of franchises this owner has — may be 0, 1, or many. */
  franchises?: FranchiseLike[] | null;
  /** Legacy single-franchise prop. Still honored so existing callers keep working. */
  franchise?: FranchiseLike | null;
  /** Optional — show a skeleton while the parent's franchise query is in flight. */
  isLoading?: boolean;
}

/* ═════════════════════════════════════════════════════════════════
   COLOR HELPERS
   Each franchise can carry its own colorFrom/colorTo. We turn that into a
   real inline gradient, and only fall back to the platform's default role
   gradient when a franchise has no brand colors set.
   ═════════════════════════════════════════════════════════════════ */
const HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(HEX_RE);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** True when a franchise's brand colors are light enough that white text would wash out. */
function needsDarkText(colorFrom?: string | null, colorTo?: string | null): boolean {
  const samples = [colorFrom, colorTo].filter(Boolean) as string[];
  if (!samples.length) return false;
  const luminances = samples.map((c) => {
    const rgb = hexToRgb(c);
    return rgb ? relativeLuminance(rgb) : 0;
  });
  return luminances.reduce((a, b) => a + b, 0) / luminances.length > 0.62;
}

function brandGradientStyle(f?: FranchiseLike | null): CSSProperties | undefined {
  if (!f) return undefined;
  const { colorFrom, colorTo } = f;
  if (colorFrom && colorTo) {
    return { backgroundImage: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)` };
  }
  if (colorFrom) {
    return { backgroundImage: `linear-gradient(135deg, ${colorFrom} 0%, ${colorFrom} 100%)` };
  }
  return undefined;
}

function initialsOf(name?: string) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/* ═════════════════════════════════════════════════════════════════
   COMPONENT
   ═════════════════════════════════════════════════════════════════ */
export function FranchiseHero({ user, franchises, franchise, isLoading }: FranchiseHeroProps) {
  const navigate = useNavigate();

  // Normalize props: prefer the list, fall back to a single legacy franchise.
  const list = useMemo<FranchiseLike[]>(() => {
    if (franchises && franchises.length) return franchises;
    if (franchise) return [franchise];
    return [];
  }, [franchises, franchise]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = activeIndex < list.length ? activeIndex : 0;
  const active = list[safeIndex] ?? null;
  const hasFranchise = !!active;
  const hasMultiple = list.length > 1;

  const [copied, setCopied] = useState(false);
  const handleCopyLink = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      if (!active) return;
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/franchises/${active.slug}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch {
        // Clipboard unavailable — non-critical, fail silently.
      }
    },
    [active]
  );

  const fallbackGradient = getRoleGradient("FRANCHISE_OWNER");
  const customStyle = brandGradientStyle(active);
  const dark = hasFranchise ? needsDarkText(active?.colorFrom, active?.colorTo) : false;

  const textPrimary = dark ? "text-slate-900" : "text-white";
  const textSecondary = dark ? "text-slate-700/85" : "text-white/80";
  const ctaClass = dark
    ? "bg-slate-900 text-white hover:bg-slate-800"
    : "bg-white text-rose-700 hover:bg-rose-50";
  const ghostCtaClass = dark
    ? "text-slate-900 hover:bg-slate-900/10 border border-slate-900/15"
    : "text-white hover:bg-white/15 hover:text-white border border-white/20";

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-100 p-6 sm:p-8 lg:p-10">
        <div className="animate-pulse space-y-5">
          <div className="h-5 w-32 rounded-full bg-slate-200" />
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-slate-200" />
            <div className="h-6 w-24 rounded-full bg-slate-200" />
          </div>
          <div className="h-10 w-40 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${fallbackGradient} p-6 shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10 ${textPrimary}`}
      style={customStyle}
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-rose-300/15 blur-3xl" />
      </div>

      {/* Contrast scrim — guarantees legibility no matter which brand colors an owner picks */}
      {customStyle && (
        <div
          className={`pointer-events-none absolute inset-0 ${
            dark
              ? "bg-gradient-to-b from-white/0 via-white/0 to-white/10"
              : "bg-gradient-to-b from-black/0 via-black/10 to-black/30"
          }`}
        />
      )}

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-4">
          {/* ── Multi-franchise switcher ── */}
          {hasMultiple && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Your franchises"
            >
              {list.map((f, i) => {
                const isActive = i === safeIndex;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveIndex(i)}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? textPrimary
                        : dark
                        ? "text-slate-900/45 hover:text-slate-900/75"
                        : "text-white/55 hover:text-white/85"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="franchise-switcher-pill"
                        className={`absolute inset-0 rounded-full ring-1 ${
                          dark ? "bg-slate-900/10 ring-slate-900/10" : "bg-white/20 ring-white/25"
                        }`}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span
                      className={`relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold ${
                        dark ? "bg-slate-900/10" : "bg-white/25"
                      }`}
                    >
                      {f.logo ? (
                        <img src={f.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initialsOf(f.name)
                      )}
                    </span>
                    <span className="relative max-w-[7rem] truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <HeroBadge>
              <Building2 className="h-3.5 w-3.5" />
              Franchise Owner
            </HeroBadge>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active?.id ?? "no-franchise"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {hasFranchise ? active!.name : user?.name}
              </h1>

              {hasFranchise ? (
                <div className="flex flex-wrap items-center gap-2">
                  {active!.city && (
                    <HeroBadge>
                      <MapPin className="h-3 w-3" />
                      {active!.city}
                    </HeroBadge>
                  )}
                  <button
                    onClick={handleCopyLink}
                    title="Copy public link"
                    className="group"
                  >
                    <HeroBadge className="cursor-pointer transition-transform group-active:scale-95">
                      @{active!.slug}
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-70" />}
                    </HeroBadge>
                  </button>
                  <HeroBadge
                    className={
                      active!.isActive
                        ? "bg-emerald-400/20 border-emerald-300/40"
                        : "bg-amber-400/20 border-amber-300/40"
                    }
                  >
                    {active!.isActive ? "Active" : "Inactive"}
                  </HeroBadge>
                  {hasMultiple && (
                    <HeroBadge>
                      <Layers className="h-3 w-3" />
                      {list.length} franchises
                    </HeroBadge>
                  )}
                </div>
              ) : (
                <p className={`max-w-md text-sm leading-relaxed ${textSecondary}`}>
                  You don&apos;t have a franchise yet. Create one to register for tournaments, build
                  your squad, and dominate the auction floor.
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3 pt-1">
            {hasFranchise ? (
              <>
                <Button
                  onClick={() => navigate(`/franchises/${active!.id}/edit`)}
                  className={`!w-auto gap-2 shadow-lg ${ctaClass}`}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Franchise
                </Button>
                {/*<Button
                  variant="ghost"
                  onClick={() => navigate(`/franchises/${active!.slug}`)}
                  className={`!w-auto gap-2 ${ghostCtaClass}`}
                >
                  View Page
                  <ArrowRight className="h-4 w-4" />
                </Button> */}
                <Button
                  variant="ghost"
                  onClick={() => navigate("/create-franchise")}
                  className={`!w-auto gap-2 ${ghostCtaClass}`}
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Franchise
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/create-franchise")} className={`!w-auto gap-2 shadow-lg ${ctaClass}`}>
                <PlusCircle className="h-4 w-4" />
                Create Franchise
              </Button>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 150 }}
          className="flex shrink-0 flex-col items-center gap-4"
        >
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-2xl text-4xl font-bold shadow-inner backdrop-blur-md ring-1 sm:h-28 sm:w-28 sm:text-5xl overflow-hidden ${
              dark ? "bg-slate-900/10 ring-slate-900/15" : "bg-white/20 ring-white/30"
            }`}
          >
            <AnimatePresence mode="wait">
              {active?.logo ? (
                <motion.img
                  key={active.logo}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  src={active.logo}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <motion.div key="fallback-icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Building2 className={`h-12 w-12 sm:h-14 sm:w-14 ${dark ? "text-slate-900/70" : "text-white/90"}`} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {hasFranchise && (
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="City" value={active!.city ?? "—"} delay={0.35} />
              <StatPill label="Status" value={active!.isActive ? "Active" : "Inactive"} delay={0.4} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}