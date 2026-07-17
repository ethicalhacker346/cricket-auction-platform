// src/components/franchise/FranchiseForm.tsx
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  Loader2,
  Building2,
  MapPin,
  FileText,
  ShieldAlert,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import {
  franchiseFormSchema,
  type FranchiseFormValues,
  sanitizeFranchisePayload,
} from "@/lib/validators/franchiseSchema";
import { SlugField } from "./SlugField";

// =============================================================================
// TYPES
// =============================================================================

interface FranchiseFormProps {
  defaultValues?: Partial<FranchiseFormValues>;
  onSubmit: (payload: Partial<FranchiseFormValues>) => void;
  isSubmitting: boolean;
  submitLabel: string;
  mode: "create" | "edit";
  /** Logo URL selected via the parent page's LogoSelector. Matches the
   * backend `logo` field name (Franchise.js) exactly — must be an
   * absolute http(s) URL, resolved by the parent page (see
   * toAbsoluteUrl in Create/EditFranchisePage), or it will silently fail
   * Zod's `.url()` check on this hidden field with no visible error. */
  logo?: string | null;
}

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

function FormProgress({ total, completed }: { total: number; completed: number }) {
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600">
            Franchise Completion
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
                ? "bg-violet-500"
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

export function FranchiseForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  mode,
  logo,
}: FranchiseFormProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthorized = user?.role === "FRANCHISE_OWNER" || user?.role === "ADMIN";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FranchiseFormValues>({
    resolver: zodResolver(franchiseFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      slug: "",
      logo: logo || "",
      city: "",
      description: "",
      ...defaultValues,
    },
  });

  // Sync `logo` from the parent's LogoSelector when it changes. This must
  // live in an effect, not the render body — calling setValue() directly
  // during render fires on every render whenever `logo` is null and the
  // field default is "" (null !== "" never resolves), which is an
  // infinite render loop. That exact bug is what froze the player
  // create/edit pages before; don't reintroduce it here.
  useEffect(() => {
    if (logo === undefined) return;
    const next = logo || "";
    if (next !== getValues("logo")) {
      setValue("logo", next, {
        shouldValidate: true,
        shouldDirty: mode === "edit" && !!defaultValues,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo]);

  const nameValue = watch("name") || "";
  const descValue = watch("description") || "";
  const cityValue = watch("city") || "";
  const nameLength = nameValue.length;
  const descLength = descValue.length;

  // Calculate completion
  const completionFields = useMemo(
    () => [
      nameValue.length >= 2,
      !!watch("slug"),
      !!cityValue,
      !!logo,
      descValue.length > 0,
    ],
    [nameValue, cityValue, logo, descValue] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const completedCount = completionFields.filter(Boolean).length;

  const handleFormSubmit = useCallback(
    (values: FranchiseFormValues) => {
      onSubmit(sanitizeFranchisePayload(values));
    },
    [onSubmit]
  );

  // Authorization guard for create mode
  if (mode === "create" && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Only Franchise Owners and Administrators can create new franchises.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-10">
      {/* Progress Bar */}
      <FormProgress total={5} completed={completedCount} />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: FRANCHISE IDENTITY
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={Building2}
        iconColor="text-violet-600"
        iconBg="bg-violet-50"
        title="Franchise Identity"
        description="Your team's name and public URL"
        delay={0.05}
      >
        <div className="space-y-5">
          <FormField
            label="Franchise Name"
            error={errors.name?.message}
            hint={<CharCounter current={nameLength} max={120} />}
            required
          >
            <div className="relative">
              <input
                {...register("name")}
                placeholder="e.g. Hyderabad Tigers"
                autoComplete="off"
                className={cn(
                  "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                  "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400",
                  "hover:border-slate-300",
                  errors.name && "border-red-300 focus:ring-red-100 focus:border-red-400"
                )}
              />
              {nameLength >= 2 && !errors.name && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              )}
            </div>
          </FormField>

          <SlugField
            value={watch("slug") ?? ""}
            onChange={useCallback(
              (val: string) => {
                setValue("slug", val, { shouldValidate: true, shouldDirty: true });
              },
              [setValue]
            )}
            nameValue={nameValue}
            error={errors.slug?.message}
          />

          <FormField label="City / Region" icon={MapPin} error={errors.city?.message}>
            <input
              {...register("city")}
              placeholder="e.g. Hyderabad, Telangana"
              autoComplete="off"
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200",
                "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400",
                "hover:border-slate-300",
                errors.city && "border-red-300 focus:ring-red-100 focus:border-red-400"
              )}
            />
          </FormField>
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: BRANDING
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={ImageIcon}
        iconColor="text-sky-600"
        iconBg="bg-sky-50"
        title="Branding & Description"
        description="How franchises appear to owners and fans"
        delay={0.1}
      >
        <div className="space-y-5">
          {/* Logo (hidden, synced from parent). The avatar itself is
              picked via LogoSelector on the parent page — kept hidden here,
              but still surfaced visibly on error so a validation failure
              is never silent (that exact silence is what made "Create
              Profile" look like a dead button on the player form). */}
          <input type="hidden" {...register("logo")} />
          {errors.logo && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {errors.logo.message} — try reselecting your logo.
            </p>
          )}

          <AnimatePresence>
            {logo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                  <div className="w-10 h-10 rounded-lg bg-white border border-violet-100 p-1.5 flex items-center justify-center shrink-0">
                    <img
                      src={logo}
                      alt="Selected franchise logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-violet-700">Logo selected</p>
                    <p className="text-[10px] text-violet-400 truncate">{logo}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <FormField
            label="Description"
            icon={FileText}
            error={errors.description?.message}
            hint={<CharCounter current={descLength} max={1000} />}
          >
            <textarea
              {...register("description")}
              rows={5}
              placeholder="Describe your franchise vision, history, and what makes your team special..."
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white text-sm transition-all duration-200 resize-none",
                "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400",
                "hover:border-slate-300 leading-relaxed",
                errors.description && "border-red-300 focus:ring-red-100 focus:border-red-400"
              )}
            />
          </FormField>
        </div>
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
              {Object.keys(dirtyFields).length} field
              {Object.keys(dirtyFields).length !== 1 ? "s" : ""} modified
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
              {mode === "create" ? "Creating..." : "Saving..."}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {submitLabel}
            </>
          )}
        </button>
      </motion.div>
    </form>
  );
}

export default FranchiseForm;