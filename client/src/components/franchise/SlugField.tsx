import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Lock, Unlock, Globe, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateSlug } from "@/lib/validators/franchiseSchema";

interface SlugFieldProps {
  value: string;
  onChange: (value: string) => void;
  nameValue: string;
  error?: string;
}

export function SlugField({ value, onChange, nameValue, error }: SlugFieldProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const toggleLock = useCallback(() => setIsLocked((prev) => !prev), []);

  // Auto-generate slug with proper debounce + skip if locked or no change
  useEffect(() => {
    if (isLocked || !nameValue) {
      if (!nameValue) onChange("");
      return;
    }

    // Clear previous timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const newSlug = generateSlug(nameValue);
      if (newSlug !== value) {
        onChange(newSlug);
      }
    }, 200); // Slightly longer debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameValue, isLocked, onChange, value]);

  const previewUrl = value ? `/franchises/${value}` : "/franchises/your-slug";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700">
          Franchise Slug <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={toggleLock}
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors",
            isLocked
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          )}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          {isLocked ? "Manual" : "Auto"}
        </button>
      </div>

      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white transition-all",
        isFocused ? "border-violet-400 ring-2 ring-violet-100" : error ? "border-red-300" : "border-slate-200"
      )}>
        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-400 select-none flex-shrink-0">gullybid.com</span>
        <span className="text-slate-300">/</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={!isLocked}
          placeholder="hyderabad-tigers"
          className={cn(
            "flex-1 bg-transparent text-sm focus:outline-none disabled:text-slate-500",
            error ? "text-red-600" : "text-slate-800"
          )}
        />
        {value && !error && <Link2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
      </div>

      <div className="flex items-center justify-between text-xs">
        {error ? (
          <span className="text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </span>
        ) : (
          <span className="text-slate-500">Public URL — cannot be changed later</span>
        )}
        <span className="font-mono text-slate-400">{previewUrl}</span>
      </div>
    </div>
  );
}