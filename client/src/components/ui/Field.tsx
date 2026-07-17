import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, required, icon, children, className }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        {children}
      </div>
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, required, className, ...props },
  ref
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} icon={icon}>
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
          icon && "pl-10",
          error ? "border-rose-300" : "border-slate-200",
          className
        )}
        {...props}
      />
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, ...props },
  ref
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
          error ? "border-rose-300" : "border-slate-200",
          className
        )}
        {...props}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, children, ...props },
  ref
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
          error ? "border-rose-300" : "border-slate-200",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
