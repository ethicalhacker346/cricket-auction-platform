import { cn } from "@/utils/cn";

function getStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const LEVELS = [
  { label: "Very weak", color: "bg-red-400" },
  { label: "Weak", color: "bg-orange-400" },
  { label: "Fair", color: "bg-amber-400" },
  { label: "Strong", color: "bg-emerald-500" },
  { label: "Very strong", color: "bg-emerald-600" },
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = getStrength(password);
  const level = LEVELS[strength];

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-slate-200 transition-colors duration-300",
              i < strength ? level.color : "bg-slate-200"
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-xs font-medium text-slate-500">
        Password strength: <span className="text-slate-700">{level.label}</span>
      </p>
    </div>
  );
}
