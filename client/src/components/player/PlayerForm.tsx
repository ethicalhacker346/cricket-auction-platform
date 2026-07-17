// src/components/player/PlayerForm.tsx
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  User,
  Globe,
  Calendar,
  FileText,
  Activity,
  Shield,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  playerFormSchema,
  type PlayerFormValues,
  sanitizePlayerPayload,
} from "@/lib/validators/playerSchema";
import { RoleSelector } from "./RoleSelector";

// =============================================================================
// TYPES
// =============================================================================

interface PlayerFormProps {
  defaultValues?: Partial<PlayerFormValues>;
  onSubmit: (payload: Partial<PlayerFormValues>) => void;
  isSubmitting: boolean;
  submitLabel: string;
  mode: "create" | "edit";
  /** Profile image URL passed from parent page's LogoSelector. Matches the
   * backend `profileImage` field name (Player.js) — do not rename to
   * `logoUrl` again or selections will silently fail to persist. */
  profileImage?: string | null;
}

// =============================================================================
// ROLE CONFIG (for visual badges)
// =============================================================================

// Keys match the backend PLAYER_ROLES enum values exactly (Player.js /
// playerApi.ts PlayerRole) — these are UPPER_SNAKE_CASE, not lowercase.
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  BATSMAN: { label: "Batsman", color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  BOWLER: { label: "Bowler", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  ALL_ROUNDER: { label: "All-Rounder", color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
  WICKET_KEEPER: { label: "Wicket Keeper", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
};

// =============================================================================
// SECTION COMPONENT
// =============================================================================

function FormSection({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
  delay = 0,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="space-y-5"
    >
      <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
        <div className={cn("p-2 rounded-xl shrink-0", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

// =============================================================================
// INPUT FIELD COMPONENT
// =============================================================================

function FormField({
  label,
  icon: Icon,
  error,
  children,
  hint,
  required = false,
}: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
      <div className="flex justify-between min-h-[18px]">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-red-500 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              {error}
            </motion.span>
          ) : (
            <span />
          )}
        </AnimatePresence>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
    </div>
  );
}

// =============================================================================
// CHARACTER COUNTER
// =============================================================================

function CharCounter({ current, max }: { current: number; max: number }) {
  const percentage = Math.min((current / max) * 100, 100);
  const isWarning = percentage > 80;
  const isDanger = percentage >= 100;

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full transition-colors duration-300",
            isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-slate-400"
        )}
      >
        {current}/{max}
      </span>
    </div>
  );
}

// =============================================================================
// FORM PROGRESS INDICATOR
// =============================================================================

function FormProgress({
  total,
  completed,
}: {
  total: number;
  completed: number;
}) {
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600">
            Profile Completion
          </span>
          <span className="text-xs font-bold text-slate-800">{percentage}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              percentage === 100
                ? "bg-emerald-500"
                : percentage >= 60
                ? "bg-blue-500"
                : "bg-amber-500"
            )}
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

export function PlayerForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  mode,
  profileImage,
}: PlayerFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: "",
      nationality: "",
      primaryRole: undefined,
      battingStyle: "",
      bowlingStyle: "",
      profileImage: profileImage || "",
      bio: "",
      ...defaultValues,
    },
  });

  // Sync profileImage from the parent's LogoSelector when it changes.
  // IMPORTANT: this must live in an effect, not the render body. Doing the
  // setValue() call directly during render (as this previously did) fires
  // on every render whenever `profileImage` is null and the field default
  // is "", because null !== "" can never become true->false — that's an
  // infinite render loop, which is what was freezing the Create/Edit pages.
  useEffect(() => {
    if (profileImage === undefined) return;
    const next = profileImage || "";
    if (next !== getValues("profileImage")) {
      setValue("profileImage", next, {
        shouldValidate: true,
        // Only mark the field dirty for genuine user changes in edit mode,
        // not for the initial sync when a saved logo loads in.
        shouldDirty: mode === "edit" && !!defaultValues,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileImage]);

  const primaryRole = watch("primaryRole");
  const bio = watch("bio") || "";
  const fullName = watch("fullName") || "";
  const nationality = watch("nationality") || "";
  const battingStyle = watch("battingStyle") || "";
  const bowlingStyle = watch("bowlingStyle") || "";
  const dateOfBirth = watch("dateOfBirth") || "";

  // Calculate completion
  const completionFields = useMemo(
    () => [
      fullName.length >= 2,
      !!dateOfBirth,
      !!nationality,
      !!primaryRole,
      !!battingStyle,
      !!bowlingStyle,
      !!profileImage,
      bio.length > 0,
    ],
    [fullName, dateOfBirth, nationality, primaryRole, battingStyle, bowlingStyle, profileImage, bio]
  );
  const completedCount = completionFields.filter(Boolean).length;

  const handleFormSubmit = useCallback(
    (values: PlayerFormValues) => {
      onSubmit(sanitizePlayerPayload(values));
    },
    [onSubmit]
  );

  const roleMeta = primaryRole ? ROLE_META[primaryRole] : null;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-10">
      {/* Progress Bar */}
      <FormProgress total={8} completed={completedCount} />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: IDENTITY
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={User}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50"
        title="Identity"
        description="Who you are on the platform"
        delay={0.05}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Full Name"
            error={errors.fullName?.message}
            hint={<CharCounter current={fullName.length} max={120} />}
            required
          >
            <div className="relative">
              <input
                {...register("fullName")}
                placeholder="e.g. Virat Kohli"
                className={cn(
                  "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                  "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
                  "hover:border-slate-300",
                  errors.fullName && "border-red-300 focus:ring-red-100 focus:border-red-400"
                )}
              />
              {fullName.length >= 2 && !errors.fullName && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              )}
            </div>
          </FormField>

          <FormField
            label="Date of Birth"
            icon={Calendar}
            error={errors.dateOfBirth?.message}
            hint="Must be 15–60 years old"
          >
            <input
              type="date"
              {...register("dateOfBirth")}
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
                "hover:border-slate-300",
                errors.dateOfBirth && "border-red-300 focus:ring-red-100 focus:border-red-400"
              )}
            />
          </FormField>

          <FormField
            label="Nationality"
            icon={Globe}
            error={errors.nationality?.message}
          >
            <div className="relative">
              <input
                {...register("nationality")}
                placeholder="e.g. India"
                list="nationalities"
                className={cn(
                  "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                  "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
                  "hover:border-slate-300"
                )}
              />
              <datalist id="nationalities">
                <option value="India" />
                <option value="Australia" />
                <option value="England" />
                <option value="Pakistan" />
                <option value="South Africa" />
                <option value="New Zealand" />
                <option value="Sri Lanka" />
                <option value="West Indies" />
                <option value="Bangladesh" />
                <option value="Afghanistan" />
              </datalist>
            </div>
          </FormField>

          {/* Profile image URL (hidden, synced from parent). Kept hidden
              because the avatar itself is picked via LogoSelector on the
              parent page, but we still surface a visible error if it's
              ever invalid — a hidden field failing validation with no UI
              is exactly what made "Create Profile" look like a dead
              button before (silently blocked submission). */}
          <input type="hidden" {...register("profileImage")} />
          {errors.profileImage && (
            <p className="md:col-span-2 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {errors.profileImage.message} — try reselecting your avatar.
            </p>
          )}
        </div>

        {/* Logo preview reminder */}
        <AnimatePresence>
          {profileImage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <div className="w-10 h-10 rounded-lg bg-white border border-indigo-100 p-1.5 flex items-center justify-center shrink-0">
                  <img
                    src={profileImage}
                    alt="Selected logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-indigo-700">Avatar selected</p>
                  <p className="text-[10px] text-indigo-400 truncate">{profileImage}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: PLAYING DETAILS
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={Activity}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
        title="Playing Details"
        description="Your role and style on the field"
        delay={0.1}
      >
        <div className="space-y-5">
          <FormField
            label="Primary Role"
            error={errors.primaryRole?.message}
            required
          >
            <RoleSelector
              value={primaryRole}
              onChange={(val) =>
                setValue("primaryRole", val as PlayerFormValues["primaryRole"], {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              error={errors.primaryRole?.message}
            />
          </FormField>

          {/* Selected role badge */}
          <AnimatePresence>
            {roleMeta && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border",
                  roleMeta.bg
                )}
              >
                <Shield className={cn("w-3 h-3", roleMeta.color)} />
                <span className={roleMeta.color}>{roleMeta.label}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Batting Style" error={errors.battingStyle?.message}>
              <div className="relative">
                <input
                  {...register("battingStyle")}
                  placeholder="e.g. Right-hand bat"
                  list="batting-styles"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                    "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400",
                    "hover:border-slate-300",
                    errors.battingStyle && "border-red-300 focus:ring-red-100 focus:border-red-400"
                  )}
                />
                <datalist id="batting-styles">
                  <option value="Right-hand bat" />
                  <option value="Left-hand bat" />
                </datalist>
              </div>
            </FormField>

            <FormField label="Bowling Style" error={errors.bowlingStyle?.message}>
              <div className="relative">
                <input
                  {...register("bowlingStyle")}
                  placeholder="e.g. Right-arm fast"
                  list="bowling-styles"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                    "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400",
                    "hover:border-slate-300",
                    errors.bowlingStyle && "border-red-300 focus:ring-red-100 focus:border-red-400"
                  )}
                />
                <datalist id="bowling-styles">
                  <option value="Right-arm fast" />
                  <option value="Right-arm medium" />
                  <option value="Left-arm fast" />
                  <option value="Left-arm medium" />
                  <option value="Off break" />
                  <option value="Leg break" />
                  <option value="Left-arm orthodox" />
                  <option value="Left-arm wrist spin" />
                </datalist>
              </div>
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: BIO
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={FileText}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
        title="Player Bio"
        description="Tell your story — achievements, journey, philosophy"
        delay={0.15}
      >
        <FormField
          label="Bio"
          error={errors.bio?.message}
          hint={<CharCounter current={bio.length} max={1000} />}
        >
          <textarea
            {...register("bio")}
            rows={5}
            placeholder="Tell us about your cricket journey, achievements, and playing philosophy..."
            className={cn(
              "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200 resize-none",
              "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400",
              "hover:border-slate-300 leading-relaxed",
              errors.bio && "border-red-300 focus:ring-red-100 focus:border-red-400"
            )}
          />
        </FormField>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SUBMIT BAR
          ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100"
      >
        <div className="flex items-center gap-2 text-sm">
          {mode === "edit" && !isDirty ? (
            <span className="text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              All changes saved
            </span>
          ) : (
            <span className="text-slate-400">
              {Object.keys(dirtyFields).length} field{Object.keys(dirtyFields).length !== 1 ? "s" : ""} modified
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || (mode === "edit" && !isDirty)}
          className={cn(
            "inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200",
            "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
            "shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === "create" ? "Creating Profile..." : "Saving Changes..."}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {submitLabel}
            </>
          )}
        </button>
      </motion.div>
    </form>
  );
}

export default PlayerForm;