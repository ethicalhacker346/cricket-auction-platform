import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  hint?: string;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, trailing, className, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "block w-full rounded-xl border bg-white/70 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-150",
              "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15",
              icon && "pl-11",
              trailing && "pr-11",
              error
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                : "border-slate-200 hover:border-slate-300",
              className
            )}
            {...props}
          />
          {trailing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
