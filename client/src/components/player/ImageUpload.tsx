// src/components/player/ImageUpload.tsx
import { useState } from "react";
import { Camera, Link2, AlertCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ImageUpload({ value, onChange, error }: ImageUploadProps) {
  const [isFocused, setIsFocused] = useState(false);

  const isValidUrl = value?.match(/^https?:\/\//);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Profile Image
      </label>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Preview Avatar */}
        <div
          className={cn(
            "relative w-28 h-28 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all duration-300",
            isValidUrl
              ? "border-emerald-200 shadow-md"
              : "border-slate-200 bg-slate-50",
            isFocused && "ring-4 ring-indigo-100 border-indigo-300"
          )}
        >
          {isValidUrl ? (
            <img
              src={value}
              alt="Profile preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-10 h-10 text-slate-300" />
            </div>
          )}

          {isValidUrl && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent py-1.5">
              <span className="text-[10px] text-white font-medium text-center block">
                Preview
              </span>
            </div>
          )}
        </div>

        {/* URL Input */}
        <div className="flex-1 w-full space-y-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="url"
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="https://example.com/photo.jpg"
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-sm transition-all",
                "placeholder:text-slate-400 focus:outline-none focus:ring-2",
                error
                  ? "border-red-300 focus:ring-red-100 focus:border-red-400"
                  : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-400"
              )}
            />
          </div>

          <p className="text-xs text-slate-500">
            Paste a direct image URL. Supported formats: JPG, PNG, WebP.
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