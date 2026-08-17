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
  Palette,
  Shuffle,
  X,
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
// COLOR PRESETS
// =============================================================================

const COLOR_PRESETS = [
  { from: "#4f46e5", to: "#06b6d4", name: "Neon Night" },
  { from: "#dc2626", to: "#fbbf24", name: "Phoenix" },
  { from: "#059669", to: "#34d399", name: "Emerald" },
  { from: "#7c3aed", to: "#c084fc", name: "Galaxy" },
  { from: "#ea580c", to: "#f97316", name: "Inferno" },
  { from: "#0f172a", to: "#475569", name: "Shadow" },
  { from: "#be123c", to: "#fb7185", name: "Rose" },
  { from: "#1d4ed8", to: "#60a5fa", name: "Ocean" },
  { from: "#ca8a04", to: "#fde047", name: "Gold" },
  { from: "#581c87", to: "#a855f7", name: "Mystic" },
  { from: "#991b1b", to: "#1c1917", name: "Red Devil" },
  { from: "#1e3a8a", to: "#fbbf24", name: "Royal" },
];

// =============================================================================
// BRAND PREVIEW CARD
// =============================================================================

function BrandPreview({
  name,
  city,
  logo,
  from,
  to,
}: {
  name: string;
  city: string;
  logo?: string | null;
  from?: string | null;
  to?: string | null;
}) {
  const hasColors = from && to;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 shadow-lg border border-white/10 transition-all duration-500"
      style={{
        background: hasColors
          ? `linear-gradient(135deg, ${from}, ${to})`
          : "linear-gradient(135deg, #64748b, #94a3b8)",
      }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center p-2.5 shrink-0">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Building2 className="w-6 h-6 text-white/80" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-lg text-white truncate">
            {name || "Your Franchise"}
          </h4>
          <p className="text-white/70 text-sm truncate">
            {city || "City, Region"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-semibold text-white/80 uppercase tracking-wider backdrop-blur-sm">
          Active
        </span>
        <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-semibold text-white/80 uppercase tracking-wider backdrop-blur-sm">
          Auction Ready
        </span>
      </div>
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
    reset, // ← ADD
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
      colorFrom: null,
      colorTo: null,
      ...defaultValues,
    },
  });

  // Sync logo from parent
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

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW: Color Watches
  // ═══════════════════════════════════════════════════════════════════════════
  const colorFromValue = watch("colorFrom") || "";
  const colorToValue = watch("colorTo") || "";
  const hasColors = !!(colorFromValue && colorToValue);

  // Calculate completion (5 core fields required)
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
          SECTION 3: TEAM COLORS  ← NEW
          ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        icon={Palette}
        iconColor="text-pink-600"
        iconBg="bg-pink-50"
        title="Team Colors"
        description="Define your franchise's visual identity with gradient colors"
        delay={0.15}
      >
        <div className="space-y-6">
          {/* Presets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Quick Presets
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const preset =
                      COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
                    setValue("colorFrom", preset.from, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    setValue("colorTo", preset.to, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <Shuffle className="w-3 h-3" />
                  Random
                </button>
                {hasColors && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue("colorFrom", null, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      setValue("colorTo", null, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isActive =
                  colorFromValue === preset.from && colorToValue === preset.to;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setValue("colorFrom", preset.from, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      setValue("colorTo", preset.to, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                    title={preset.name}
                  >
                    <div
                      className={cn(
                        "w-full h-10 rounded-lg shadow-sm border-2 transition-all duration-200",
                        isActive
                          ? "border-slate-900 scale-105 shadow-md"
                          : "border-transparent group-hover:border-slate-200"
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                      }}
                    />
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate w-full text-center">
                      {preset.name}
                    </span>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField
              label="Primary Color"
              error={errors.colorFrom?.message}
              hint={
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Gradient start
                </span>
              }
            >
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 ring-offset-2 transition-all hover:ring-2 hover:ring-slate-200">
                  <input
                    type="color"
                    value={colorFromValue || "#4f46e5"}
                    onChange={(e) =>
                      setValue("colorFrom", e.target.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer p-0 border-0 bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <input
                    {...register("colorFrom")}
                    value={colorFromValue} 
                    placeholder="#4F46E5"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono uppercase tracking-wider transition-all duration-200",
                      "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400",
                      "hover:border-slate-300",
                      errors.colorFrom && "border-red-300 focus:ring-red-100 focus:border-red-400"
                    )}
                  />
                </div>
              </div>
            </FormField>

            <FormField
              label="Secondary Color"
              error={errors.colorTo?.message}
              hint={
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Gradient end
                </span>
              }
            >
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 ring-offset-2 transition-all hover:ring-2 hover:ring-slate-200">
                  <input
                    type="color"
                    value={colorToValue || "#06b6d4"}
                    onChange={(e) =>
                      setValue("colorTo", e.target.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer p-0 border-0 bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <input
                    {...register("colorTo")}
                    value={colorToValue} 
                    placeholder="#06B6D4"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono uppercase tracking-wider transition-all duration-200",
                      "placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400",
                      "hover:border-slate-300",
                      errors.colorTo && "border-red-300 focus:ring-red-100 focus:border-red-400"
                    )}
                  />
                </div>
              </div>
            </FormField>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Live Preview
              </span>
              {hasColors && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"
                >
                  Brand identity active
                </motion.span>
              )}
            </div>
            <BrandPreview
              name={nameValue}
              city={cityValue}
              logo={logo}
              from={colorFromValue}
              to={colorToValue}
            />
          </div>
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