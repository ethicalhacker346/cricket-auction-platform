import { useId } from "react";
import { Check } from "lucide-react";
import {
  REGISTERABLE_ROLES,
  type RegisterableRole,
} from "@/lib/constants/roles";
import { cn } from "@/utils/cn";

interface RoleSelectorProps {
  value: RegisterableRole | undefined;
  onChange: (role: RegisterableRole) => void;
  error?: string;
}

export function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 block text-sm font-medium text-slate-700">
        I’m joining as a
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {REGISTERABLE_ROLES.map((role) => {
          const Icon = role.icon;
          const active = value === role.value;
          return (
            <label key={role.value} className="relative cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name={`${id}-role`}
                value={role.value}
                checked={active}
                onChange={() => onChange(role.value)}
              />
              <span
                className={cn(
                  "relative flex h-full flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-emerald-700",
                  active
                    ? "border-emerald-600 bg-emerald-50/70"
                    : "border-slate-300 bg-white/70 hover:border-emerald-700",
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-700 text-white">
                    <Check
                      className="h-3 w-3"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    active
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {role.label}
                </span>
                <span className="text-xs leading-relaxed text-slate-600">
                  {role.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
