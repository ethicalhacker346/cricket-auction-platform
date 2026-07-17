// src/components/player/RoleSelector.tsx
import { useCallback, useRef } from "react";
import { Sword, Target, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleMeta {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
  gradient: string;
  iconColor: string;
}

const ROLES: RoleMeta[] = [
  {
    value: "BATSMAN",
    label: "Batsman",
    icon: Sword,
    description: "Specialist run-scorer",
    gradient: "from-amber-500 to-orange-600",
    iconColor: "text-amber-500",
  },
  {
    value: "BOWLER",
    label: "Bowler",
    icon: Target,
    description: "Wicket-taking specialist",
    gradient: "from-emerald-500 to-teal-600",
    iconColor: "text-emerald-500",
  },
  {
    value: "ALL_ROUNDER",
    label: "All-Rounder",
    icon: Zap,
    description: "Versatile with bat & ball",
    gradient: "from-violet-500 to-purple-600",
    iconColor: "text-violet-500",
  },
  {
    value: "WICKET_KEEPER",
    label: "Wicket Keeper",
    icon: Shield,
    description: "Guardian behind the stumps",
    gradient: "from-sky-500 to-blue-600",
    iconColor: "text-sky-500",
  },
];

interface RoleSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  /**
   * Used only for aria-invalid + a subtle error ring on the control.
   * NOTE: this component intentionally does NOT render its own label or
   * error text. It's always used inside PlayerForm's <FormField>, which
   * already renders the "Primary Role *" label and the validation message.
   * Rendering them here too caused the label and error to visibly appear
   * twice on screen. If you use RoleSelector somewhere without a
   * FormField wrapper, render your own label/error around it.
   */
  error?: string;
  /** Optional id of an external label element (e.g. FormField's <label>)
   * for screen readers, if the consumer wires one up. */
  labelledBy?: string;
}

export function RoleSelector({ value, onChange, error, labelledBy }: RoleSelectorProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAt = (index: number) => {
    btnRefs.current[index]?.focus();
  };

  // Roving-tabindex radiogroup keyboard pattern: arrow keys move both
  // selection and focus between role cards, Home/End jump to the ends.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = ROLES.findIndex((r) => r.value === value);
      const activeIndex = currentIndex >= 0 ? currentIndex : 0;
      let nextIndex = activeIndex;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (activeIndex + 1) % ROLES.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (activeIndex - 1 + ROLES.length) % ROLES.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = ROLES.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onChange(ROLES[nextIndex].value);
      focusAt(nextIndex);
    },
    [value, onChange]
  );

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Primary role"}
      aria-invalid={!!error}
      onKeyDown={handleKeyDown}
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl transition-shadow",
        error && "ring-2 ring-red-200 ring-offset-2 p-1 -m-1"
      )}
    >
      {ROLES.map((role, index) => {
        const Icon = role.icon;
        const isSelected = value === role.value;
        // Only one card sits in the tab order at a time (the selected
        // one, or the first card if nothing is selected yet); arrow keys
        // move focus within the group, matching native radio-button UX.
        const isTabbable = value ? isSelected : index === 0;

        return (
          <button
            key={role.value}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isTabbable ? 0 : -1}
            onClick={() => onChange(role.value)}
            className={cn(
              "group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ease-out",
              "hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-offset-2",
              isSelected
                ? cn(
                    "border-transparent bg-gradient-to-br text-white shadow-lg scale-[1.02]",
                    role.gradient,
                    "focus:ring-opacity-50"
                  )
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-md focus:ring-slate-200"
            )}
          >
            <div
              className={cn(
                "p-2.5 rounded-xl mb-2 transition-colors",
                isSelected ? "bg-white/20" : "bg-slate-50 group-hover:bg-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "w-6 h-6 transition-colors",
                  isSelected ? "text-white" : role.iconColor
                )}
              />
            </div>

            <span className="font-bold text-sm">{role.label}</span>
            <span
              className={cn(
                "text-xs mt-1 font-medium",
                isSelected ? "text-white/90" : "text-slate-400"
              )}
            >
              {role.description}
            </span>

            {isSelected && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default RoleSelector;