import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  CalendarClock,
  Gavel,
  Layers,
  MapPin,
  Tag,
  Timer,
  Trophy,
  Users,
  Info,
  ImageIcon,
  ChevronUp,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { LogoSelector } from "@/components/ui/LogoSelector";
import { LOGO_LIBRARY, type Logo } from "@/components/ui/logoLibrary";
import { tournamentFormSchema, type TournamentFormValues } from "@/lib/validators/tournament";
import { slugify } from "@/lib/format";
import { CURRENCIES } from "@/lib/constants/tournament";

type TournamentFormInput = z.input<typeof tournamentFormSchema>;

interface TournamentFormProps {
  defaultValues: TournamentFormValues;
  onSubmit: (values: TournamentFormValues) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  lockSlug?: boolean;
}

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// LOGO_LIBRARY stores logos as root-relative paths (e.g.
// "/logos/tournaments/championship.png"), but Tournament.js's Mongoose
// validator requires an absolute http(s) URL, and so does the Zod schema's
// `logo: z.string().url()` check. A hidden field failing that check
// silently blocks the whole submit with no visible error — this exact bug
// already bit the player form once. Resolve to absolute at selection time.
function toAbsoluteUrl(url: string) {
  if (!url) return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

function findLibraryLogo(url?: string): Logo | null {
  if (!url) return null;
  const found = LOGO_LIBRARY.find((l) => toAbsoluteUrl(l.url) === url);
  if (found) return { ...found, url: toAbsoluteUrl(found.url) };
  // The saved logo doesn't match a library entry (e.g. was set some other
  // way) — still show *something* meaningful instead of silently losing it.
  return { id: "custom", url, name: "Current logo", category: "tournament" };
}

// =============================================================================
// SECTION HEADER
// =============================================================================

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// =============================================================================
// COMPLETION TRACKER
// =============================================================================

function CompletionTracker({ total, completed }: { total: number; completed: number }) {
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600">Tournament Completion</span>
          <span className="text-xs font-bold text-slate-800">{percentage}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              percentage === 100 ? "bg-emerald-500" : percentage >= 60 ? "bg-sky-500" : "bg-amber-500"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
      {percentage === 100 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </motion.div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TournamentForm({ defaultValues, onSubmit, isSubmitting, submitLabel, lockSlug }: TournamentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TournamentFormInput, unknown, TournamentFormValues>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      ...defaultValues,
      registrationDeadline: toDateInputValue(defaultValues.registrationDeadline),
      auctionDate: toDateInputValue(defaultValues.auctionDate),
    },
  });

  const [slugTouched, setSlugTouched] = useState(lockSlug ? true : !!defaultValues.slug);
  const nameValue = watch("name");

  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue("slug", slugify(nameValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, slugTouched]);

  // ─── Logo / Branding state ───────────────────────────────────────────
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(() =>
    findLibraryLogo(defaultValues.logo)
  );
  const [showLogoSelector, setShowLogoSelector] = useState(false);

  const handleLogoChange = (logo: Logo) => {
    // LogoSelector's "clear" action calls onChange with an
    // empty-but-truthy Logo object ({ id: "", url: "", ... }) — normalize
    // that to a real null.
    setSelectedLogo(logo.url ? { ...logo, url: toAbsoluteUrl(logo.url) } : null);
  };

  // Sync the hidden `logo` field from selectedLogo. Lives in an effect,
  // not the render body — calling setValue() directly during render fires
  // on every render whenever the values don't happen to already match,
  // which is an infinite render loop for the "nothing selected yet" case.
  // That exact bug once froze the player create/edit pages.
  useEffect(() => {
    const next = selectedLogo?.url || "";
    if (next !== getValues("logo")) {
      setValue("logo", next, { shouldValidate: true, shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogo]);

  // ─── Completion tracker ──────────────────────────────────────────────
  const venueValue = watch("venue");
  const seasonValue = watch("season");
  const descriptionValue = watch("description");
  const registrationDeadlineValue = watch("registrationDeadline");
  const auctionDateValue = watch("auctionDate");

  const completionFields = useMemo(
    () => [
      (nameValue ?? "").length >= 3,
      !!venueValue,
      !!seasonValue,
      !!descriptionValue,
      !!registrationDeadlineValue,
      !!auctionDateValue,
      !!selectedLogo,
    ],
    [nameValue, venueValue, seasonValue, descriptionValue, registrationDeadlineValue, auctionDateValue, selectedLogo]
  );
  const completedCount = completionFields.filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <CompletionTracker total={completionFields.length} completed={completedCount} />

      {/* ═══════════════════════════════════════════════════════════════
          BASIC INFORMATION
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.02 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <SectionHeader
          icon={Info}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          title="Basic information"
          description="What players and franchises will see first"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Tournament name"
            required
            icon={<Trophy className="h-4 w-4" />}
            placeholder="e.g. Mumbai Gully Premier League 2026"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Slug"
            required
            hint={lockSlug ? "Slug can't be changed after creation" : "Auto-generated from the name, editable"}
            icon={<Tag className="h-4 w-4" />}
            disabled={lockSlug}
            error={errors.slug?.message}
            {...register("slug", {
              onChange: () => setSlugTouched(true),
            })}
          />
          <Input label="Season" placeholder="e.g. Season 4" error={errors.season?.message} {...register("season")} />
          <Input
            label="Venue"
            icon={<MapPin className="h-4 w-4" />}
            placeholder="e.g. Shivaji Park Turf, Mumbai"
            error={errors.venue?.message}
            {...register("venue")}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Description"
            rows={3}
            placeholder="Tell players and franchises what makes this tournament special…"
            error={errors.description?.message}
            {...register("description")}
          />
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════
          BRANDING — logo via LogoSelector
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06 }}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="p-6 pb-0">
          <SectionHeader
            icon={ImageIcon}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            title="Branding"
            description="Give your tournament a memorable crest"
          />
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row items-center gap-5">
          <motion.div
            layout
            className={`relative w-20 h-20 rounded-2xl flex items-center justify-center border-2 shrink-0 transition-all duration-300 ${
              selectedLogo
                ? "border-amber-400/40 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md shadow-amber-500/10"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <AnimatePresence mode="wait">
              {selectedLogo ? (
                <motion.img
                  key={selectedLogo.url}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  src={selectedLogo.url}
                  alt={selectedLogo.name}
                  className="w-14 h-14 object-contain"
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-1 text-slate-400"
                >
                  <Trophy className="w-6 h-6" />
                  <span className="text-[9px]">No logo</span>
                </motion.div>
              )}
            </AnimatePresence>
            {selectedLogo && (
              <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
                <Pencil className="w-3 h-3 text-white" />
              </div>
            )}
          </motion.div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <h4 className="font-semibold text-slate-800">
              {selectedLogo ? selectedLogo.name : "No Logo Selected"}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedLogo
                ? "Shown on the tournament page, brackets, and auction room."
                : "Choose a crest to make this tournament instantly recognizable."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoSelector((s) => !s)}
            className={`flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-lg shrink-0 ${
              showLogoSelector
                ? "text-amber-600 bg-amber-50"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showLogoSelector ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Close Library
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                {selectedLogo ? "Change Logo" : "Choose Logo"}
              </>
            )}
          </button>
        </div>

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
                    <span className="text-sm font-semibold text-white">Tournament Logo Library</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLogoSelector(false)}
                    className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
                <LogoSelector
                  userRole="organizer"
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

        {/* Hidden field, kept visible-on-error so a validation failure is
            never silent — see toAbsoluteUrl comment above for why this
            matters. */}
        <input type="hidden" {...register("logo")} />
        {errors.logo && (
          <p className="px-6 pb-4 -mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.logo.message} — try reselecting your logo.
          </p>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════
          SCHEDULE
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <SectionHeader
          icon={CalendarClock}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
          title="Schedule"
          description="Registration and auction dates"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Registration deadline"
            type="date"
            icon={<CalendarClock className="h-4 w-4" />}
            error={errors.registrationDeadline?.message}
            {...register("registrationDeadline")}
          />
          <Input
            label="Auction date"
            type="date"
            icon={<Gavel className="h-4 w-4" />}
            error={errors.auctionDate?.message}
            {...register("auctionDate")}
          />
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════
          AUCTION CONFIGURATION
          ═══════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <SectionHeader
          icon={Gavel}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          title="Auction configuration"
          description="Franchise limits, purse, and bidding rules"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Max franchises"
            type="number"
            icon={<Users className="h-4 w-4" />}
            error={errors.maxTeams?.message}
            {...register("maxTeams")}
          />
          <Input
            label="Squad size"
            type="number"
            icon={<Trophy className="h-4 w-4" />}
            error={errors.squadSize?.message}
            {...register("squadSize")}
          />
          <Select label="Currency" error={errors.currency?.message} {...register("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            label="Purse per franchise"
            type="number"
            icon={<Banknote className="h-4 w-4" />}
            error={errors.defaultPurse?.message}
            {...register("defaultPurse")}
          />
          <Input
            label="Minimum bid increment"
            type="number"
            icon={<Layers className="h-4 w-4" />}
            error={errors.minBidIncrement?.message}
            {...register("minBidIncrement")}
          />
          <Input
            label="Lot timer (seconds)"
            type="number"
            icon={<Timer className="h-4 w-4" />}
            error={errors.lotTimerSeconds?.message}
            {...register("lotTimerSeconds")}
          />
        </div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-end gap-3"
      >
        <Button type="submit" className="!w-auto" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </motion.div>
    </form>
  );
}