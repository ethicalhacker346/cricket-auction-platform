import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Mail,
  Phone,
  ShieldCheck,
  Clock,
  UserCircle,
  TrendingUp,
  Trophy,
  ClipboardList,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

/* ── Utils ── */
const formatMemberSince = (date?: string | Date | null): string => {
  if (!date) return "—";
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return "—";
    return format(parsed, "d MMM yyyy");
  } catch {
    return "—";
  }
};

/* ── Types ── */
interface AccountField {
  icon: React.ElementType;
  label: string;
  value: string;
  copy?: boolean;
  emptyAction?: string;
  valueClass?: string;
}

interface AccountCardProps {
  user: any;
  isLoading?: boolean;
  roleGlow: string;
  myOrganized: number;
  draftCount: number;
  liveCount: number;
}

export function AccountCard({ user, isLoading, roleGlow, myOrganized, draftCount, liveCount }: AccountCardProps) {
  const navigate = useNavigate();

  const fields: AccountField[] = [
    { icon: Mail, label: "Email", value: user?.email ?? "—", copy: true },
    { icon: Phone, label: "Phone", value: user?.phone?.trim() ? user.phone : "Not provided", emptyAction: "Add" },
    { icon: ShieldCheck, label: "Account Status", value: user?.isActive ? "Active" : "Inactive", valueClass: user?.isActive ? "text-emerald-600" : "text-slate-400" },
    { icon: Clock, label: "Member since", value: formatMemberSince(user?.createdAt) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 14 }}
      className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md lg:col-span-3 flex flex-col"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
            <UserCircle className="h-4 w-4 text-slate-600" />
          </span>
          Account details
        </h2>
        {isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Updating…
          </span>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-slate-100 hover:bg-slate-50/80 hover:shadow-sm"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${roleGlow} transition-transform group-hover:scale-105`}
            >
              <field.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {field.label}
              </dt>
              <dd className={`mt-0.5 truncate text-sm font-semibold text-slate-800 ${field.valueClass ?? ""}`}>
                {field.value}
              </dd>
            </div>
            {field.copy && field.value !== "—" && (
              <button
                onClick={() => navigator.clipboard?.writeText(field.value)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-slate-400 hover:text-blue-600"
                title="Copy"
              >
                Copy
              </button>
            )}
            {field.emptyAction && field.value === "Not provided" && (
              <button
                onClick={() => navigate("/settings")}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-blue-600 hover:text-blue-700"
              >
                {field.emptyAction}
              </button>
            )}
          </div>
        ))}
      </dl>

      {user?.role === "ORGANIZER" && (
        <div className="mt-6 rounded-xl bg-slate-50 p-5 border border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Organizer snapshot
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Created", value: myOrganized, icon: Trophy, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Drafts", value: draftCount, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Live now", value: liveCount, icon: Zap, color: "text-rose-600", bg: "bg-rose-50" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl ${s.bg} p-3 text-center border border-black/5`}>
                <s.icon className={`mx-auto h-4 w-4 ${s.color} mb-1`} />
                <div className="text-xl font-bold text-slate-900">{s.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {user?.role === "ADMIN" && (
        <div className="mt-6 rounded-xl bg-violet-50 p-5 border border-violet-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-900 mb-2">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            Admin privileges active
          </div>
          <p className="text-xs text-violet-700 leading-relaxed">
            You have full platform access. Exercise caution when modifying tournaments, users, or auction states.
          </p>
        </div>
      )}
    </motion.div>
  );
}