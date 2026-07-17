// src/components/franchise/LogoUpload.tsx
import { useState, useCallback } from "react";
import { ImageIcon, Link2, AlertCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}

export function LogoUpload({ value, onChange, error }: LogoUploadProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isValidUrl = value?.match(/^https?:\/\//);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #9: Use useCallback for stable event handlers
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setImgError(false); // Reset image error when URL changes
  }, [onChange]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);
  const handleImgError = useCallback(() => setImgError(true), []);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Franchise Logo
      </label>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Preview */}
        <div
          className={cn(
            "relative w-28 h-28 rounded-2xl overflow-hidden border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300",
            isValidUrl && !imgError
              ? "border-violet-200 shadow-md"
              : "border-slate-200 bg-slate-50",
            isFocused && "ring-4 ring-violet-100 border-violet-300"
          )}
        >
          {isValidUrl && !imgError ? (
            <img
              src={value}
              alt="Franchise logo preview"
              className="w-full h-full object-contain p-2"
              onError={handleImgError}
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Building2 className="w-10 h-10 text-slate-300" />
              {imgError && (
                <span className="text-[10px] text-red-400 text-center px-2">
                  Invalid image
                </span>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-1 w-full space-y-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="url"
              value={value ?? ""}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="https://cdn.example.com/logo.png"
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-sm transition-all",
                "placeholder:text-slate-400 focus:outline-none focus:ring-2",
                error
                  ? "border-red-300 focus:ring-red-100 focus:border-red-400"
                  : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
              )}
            />
          </div>
          <p className="text-xs text-slate-500">
            Recommended: 512×512px PNG with transparent background.
          </p>
          {error && (
            <div className="flex items-center gap-1.5 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}