import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { REGISTERABLE_ROLES } from "@/lib/constants/roles";
import type { UserRole } from "@/types/auth";
import { cn } from "@/utils/cn";

interface RoleSelectorProps {
  value: UserRole | undefined;
  onChange: (role: UserRole) => void;
  error?: string;
}

export function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        I'm joining as a
      </span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {REGISTERABLE_ROLES.map((role) => {
          const Icon = role.icon;
          const active = value === role.value;
          return (
            <button
              type="button"
              key={role.value}
              onClick={() => onChange(role.value)}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150",
                active
                  ? "border-emerald-500 bg-emerald-50/70 shadow-sm shadow-emerald-500/10"
                  : "border-slate-200 bg-white/70 hover:border-slate-300"
              )}
            >
              {active && (
                <motion.span
                  layoutId="role-check"
                  className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500 text-white"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  active ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{role.label}</span>
              <span className="text-xs leading-snug text-slate-500">
                {role.description}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}