"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Check,
  ImageIcon,
  User,
  Building2,
  Trophy,
  X,
  Sparkles,
  Loader2,
  Upload,
  FileImage,
  AlertCircle,
} from "lucide-react";
import type { Logo, LogoCategory } from "./logoLibrary";

// =============================================================================
// TYPES
// =============================================================================

export type UserRole = "player" | "franchise_owner" | "organizer" | "admin";

export interface LogoSelectorProps {
  userRole: UserRole;
  /** Current image URL (from library or Cloudinary) */
  value?: string | null;
  /** Available library assets */
  logos: Logo[];
  /** Called when user selects a library logo */
  onSelect: (logo: Logo) => void;
  /** Called when user drops/selects a file for custom upload */
  onUpload?: (file: File) => Promise<void>;
  /** Called when user clicks Remove */
  onRemove?: () => Promise<void> | void;
  /** Loading state from parent's upload mutation */
  isUploading?: boolean;
  /** Loading state from parent's remove mutation */
  isRemoving?: boolean;
  /** Show the custom upload tab? Default true */
  allowUpload?: boolean;
  /** Show the remove button? Default true */
  allowRemove?: boolean;
  /** Max file size in bytes (default 5MB) */
  maxFileSize?: number;
  /** Accepted MIME types */
  acceptedTypes?: string[];
  className?: string;
  searchDebounceMs?: number;
  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  showUrlInPreview?: boolean;
  emptyMessage?: string;
  ariaLabel?: string;
}

// =============================================================================
// CONFIG
// =============================================================================

const CATEGORY_META: Record<
  LogoCategory,
  { label: string; icon: React.ElementType; gradient: string; accent: string; ring: string }
> = {
  player: {
    label: "Player",
    icon: User,
    gradient: "from-blue-500/20 to-cyan-500/20",
    accent: "text-blue-400",
    ring: "focus:ring-blue-500",
  },
  franchise: {
    label: "Franchise",
    icon: Building2,
    gradient: "from-purple-500/20 to-pink-500/20",
    accent: "text-purple-400",
    ring: "focus:ring-purple-500",
  },
  tournament: {
    label: "Tournament",
    icon: Trophy,
    gradient: "from-amber-500/20 to-orange-500/20",
    accent: "text-amber-400",
    ring: "focus:ring-amber-500",
  },
};

const ROLE_TAB_MAP: Record<UserRole, LogoCategory[]> = {
  player: ["player"],
  franchise_owner: ["franchise"],
  organizer: ["tournament"],
  admin: ["player", "franchise", "tournament"],
};

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// =============================================================================
// HOOKS
// =============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function usePreloadImages(urls: string[]) {
  useEffect(() => {
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [urls]);
}

function useGridColumns(
  containerRef: React.RefObject<HTMLElement | null>,
  overrides?: LogoSelectorProps["columns"]
) {
  const [cols, setCols] = useState(3);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calc = () => {
      const w = el.clientWidth;
      if (w >= 1280) setCols(overrides?.xl ?? 6);
      else if (w >= 1024) setCols(overrides?.lg ?? 5);
      else if (w >= 768) setCols(overrides?.md ?? 4);
      else if (w >= 640) setCols(overrides?.sm ?? 3);
      else setCols(3);
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, overrides]);

  return cols;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ModeToggle({
  mode,
  onChange,
  allowUpload,
}: {
  mode: "library" | "upload";
  onChange: (m: "library" | "upload") => void;
  allowUpload: boolean;
}) {
  if (!allowUpload) return null;

  return (
    <div className="flex p-1 bg-slate-800/60 rounded-xl border border-slate-700/50">
      {(["library", "upload"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`
            relative flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
            transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40
            ${mode === m ? "text-white" : "text-slate-400 hover:text-slate-200"}
          `}
        >
          {m === "library" ? (
            <>
              <ImageIcon className="w-4 h-4" />
              <span>Library</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </>
          )}
          {mode === m && (
            <motion.div
              layoutId="modeToggle"
              className="absolute inset-0 bg-slate-700 rounded-lg shadow-sm"
              style={{ zIndex: -1 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function UploadZone({
  onUpload,
  isUploading,
  maxFileSize,
  acceptedTypes,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
  maxFileSize: number;
  acceptedTypes: string[];
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const localPreview = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile]
  );

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  // Clear pending file when upload finishes
  useEffect(() => {
    if (!isUploading && pendingFile) {
      setPendingFile(null);
    }
  }, [isUploading]);

  const validate = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        const exts = acceptedTypes.map((t) => t.replace("image/", ".")).join(", ");
        return `Invalid format. Allowed: ${exts}`;
      }
      if (file.size > maxFileSize) {
        return `File too large. Max: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
      }
      return null;
    },
    [acceptedTypes, maxFileSize]
  );

  const handleFile = useCallback(
    (file: File) => {
      setLocalError(null);
      const err = validate(file);
      if (err) {
        setLocalError(err);
        return;
      }
      setPendingFile(file);
      onUpload(file);
    },
    [validate, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[240px] rounded-2xl border-2 border-dashed
          transition-all duration-300 cursor-pointer
          ${isDragging
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50"
          }
          ${isUploading ? "pointer-events-none opacity-70" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload custom image"
        />

        {pendingFile && localPreview ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6">
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
              <img
                src={localPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
                {pendingFile.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(pendingFile.size / 1024).toFixed(1)} KB
              </p>
              {isUploading && (
                <p className="text-xs text-blue-400 mt-2 animate-pulse">
                  Uploading to Cloudinary…
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              className={`
                w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                transition-colors duration-300
                ${isDragging ? "bg-blue-500/20" : "bg-slate-800/60"}
              `}
            >
              <Upload
                className={`w-7 h-7 ${isDragging ? "text-blue-400" : "text-slate-500"}`}
              />
            </div>
            <p className="text-sm font-semibold text-slate-300 mb-1">
              {isDragging ? "Drop to upload" : "Drag & drop or click to browse"}
            </p>
            <p className="text-xs text-slate-500">
              {acceptedTypes.map((t) => t.replace("image/", ".").toUpperCase()).join(", ")} up to{" "}
              {(maxFileSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        )}
      </div>

      {localError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{localError}</span>
        </motion.div>
      )}
    </div>
  );
}

function LogoCard({
  logo,
  selected,
  onClick,
  index,
  focused,
  onFocus,
}: {
  logo: Logo;
  selected: boolean;
  onClick: () => void;
  index: number;
  focused: boolean;
  onFocus: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const meta = CATEGORY_META[logo.category];
  const Icon = meta.icon;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -16 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
      onClick={onClick}
      onFocus={onFocus}
      className={`
        group relative w-full aspect-square rounded-2xl overflow-hidden
        border-2 transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${meta.ring}
        ${selected
          ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.25)] scale-[1.03] z-10"
          : "border-slate-700/60 hover:border-slate-500 hover:shadow-xl hover:shadow-black/30 hover:scale-[1.02]"
        }
        ${focused ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-400/50" : ""}
      `}
      aria-label={`${logo.name} logo`}
      aria-pressed={selected}
      tabIndex={0}
    >
      <div
        className={`
          absolute inset-0 bg-gradient-to-br ${meta.gradient}
          opacity-0 group-hover:opacity-100 transition-opacity duration-300
        `}
      />

      <div className="absolute inset-0 flex items-center justify-center p-5">
        {!loaded && !error && (
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        )}

        {error ? (
          <div className="flex flex-col items-center gap-1.5 text-slate-500">
            <Icon className="w-9 h-9 opacity-40" />
            <span className="text-[10px]">Unavailable</span>
          </div>
        ) : (
          <img
            src={logo.url}
            alt={logo.name}
            className={`
              w-full h-full object-contain transition-all duration-300
              ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}
              ${!selected ? "group-hover:scale-110" : ""}
            `}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            loading="lazy"
          />
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/10"
          >
            <div className="absolute top-2.5 right-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function CategoryTab({
  category,
  active,
  onClick,
  count,
}: {
  category: LogoCategory;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
        transition-all duration-300 whitespace-nowrap select-none
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500
        ${active
          ? "bg-slate-800 text-white shadow-lg shadow-black/20"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
        }
      `}
      aria-selected={active}
      role="tab"
      tabIndex={0}
    >
      <Icon className={`w-4 h-4 ${active ? meta.accent : ""}`} />
      <span>{meta.label}</span>
      <span
        className={`
          ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums
          ${active ? "bg-slate-700 text-slate-300" : "bg-slate-800/80 text-slate-500"}
        `}
      >
        {count}
      </span>
      {active && (
        <motion.div
          layoutId="logoTab"
          className="absolute inset-0 rounded-xl border-2 border-blue-500/30"
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      )}
    </button>
  );
}

function SelectedBanner({
  logo,
  url,
  onClear,
  showUrl,
  isRemoving,
}: {
  logo: Logo | null;
  url?: string | null;
  onClear: () => void;
  showUrl?: boolean;
  isRemoving?: boolean;
}) {
  const meta = logo ? CATEGORY_META[logo.category] : null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="overflow-hidden"
    >
      <div className="relative p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-900/60 border border-slate-700/50 p-2 flex items-center justify-center shrink-0 overflow-hidden">
            {url ? (
              <img
                src={url}
                alt="Selected"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <FileImage className="w-7 h-7 text-slate-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">
                {logo?.name || "Custom Upload"}
              </span>
              {logo && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 ${meta?.accent}`}
                >
                  {logo.category}
                </span>
              )}
              {!logo && url && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-emerald-400">
                  Cloudinary
                </span>
              )}
            </div>
            {showUrl && url && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{url}</p>
            )}
          </div>
          <button
            onClick={onClear}
            disabled={isRemoving}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Clear selection"
          >
            {isRemoving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ query, message }: { query: string; message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 px-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
        <ImageIcon className="w-7 h-7 text-slate-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-1">
        {query ? "No matches found" : message || "No logos available"}
      </h3>
      <p className="text-xs text-slate-500 text-center max-w-xs">
        {query
          ? `Try a different search term. No logos match "${query}".`
          : "There are no logos in this category yet."}
      </p>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LogoSelector({
  userRole,
  value,
  logos,
  onSelect,
  onUpload,
  onRemove,
  isUploading = false,
  isRemoving = false,
  allowUpload = true,
  allowRemove = true,
  maxFileSize = 5 * 1024 * 1024,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className = "",
  searchDebounceMs = 150,
  columns,
  showUrlInPreview = false,
  emptyMessage,
  ariaLabel = "Logo selector",
}: LogoSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<LogoCategory | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [activeMode, setActiveMode] = useState<"library" | "upload">("library");
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, searchDebounceMs);

  const visibleCategories = useMemo(() => ROLE_TAB_MAP[userRole], [userRole]);
  const gridCols = useGridColumns(gridRef, columns);

  // Auto-set category
  useEffect(() => {
    if (visibleCategories.length > 0) {
      setActiveCategory((prev) =>
        prev && visibleCategories.includes(prev) ? prev : visibleCategories[0]
      );
    }
  }, [visibleCategories]);

  // Filtered logos
  const filtered = useMemo(() => {
    if (!activeCategory) return [];
    return logos.filter((logo) => {
      const inCategory = logo.category === activeCategory;
      const q = debouncedSearch.toLowerCase();
      const matchesSearch =
        !q || logo.name.toLowerCase().includes(q) || logo.id.toLowerCase().includes(q);
      return inCategory && matchesSearch;
    });
  }, [logos, activeCategory, debouncedSearch]);

  // Preload visible logos
  usePreloadImages(filtered.map((l) => l.url));

  // Category counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    const q = debouncedSearch.toLowerCase();
    visibleCategories.forEach((cat) => {
      c[cat] = logos.filter(
        (l) =>
          l.category === cat &&
          (!q || l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q))
      ).length;
    });
    return c;
  }, [logos, visibleCategories, debouncedSearch]);

  // Selected logo object (null if custom upload)
  const selectedLogo = useMemo(
    () => logos.find((l) => l.url === value) || null,
    [logos, value]
  );

  // Keyboard: Cmd/Ctrl + K focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Keyboard: Arrow navigation in grid
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!gridRef.current || filtered.length === 0) return;
      if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
        e.preventDefault();
      }

      const cards = gridRef.current.querySelectorAll<HTMLElement>("button[aria-pressed]");
      let next = focusedIndex;

      switch (e.key) {
        case "ArrowRight":
          next = (focusedIndex + 1) % filtered.length;
          break;
        case "ArrowLeft":
          next = focusedIndex <= 0 ? filtered.length - 1 : focusedIndex - 1;
          break;
        case "ArrowDown":
          next = Math.min(focusedIndex + gridCols, filtered.length - 1);
          break;
        case "ArrowUp":
          next = Math.max(focusedIndex - gridCols, 0);
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            onSelect(filtered[focusedIndex]);
          }
          return;
        case "Escape":
          searchRef.current?.focus();
          setFocusedIndex(-1);
          return;
      }

      setFocusedIndex(next);
      cards[next]?.focus();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, focusedIndex, gridCols, onSelect]);

  const handleClear = useCallback(() => {
    onRemove?.();
  }, [onRemove]);

  const handleUpload = useCallback(
    (file: File) => {
      onUpload?.(file);
    },
    [onUpload]
  );

  return (
    <div
      className={`
        w-full bg-slate-900/60 backdrop-blur-xl rounded-3xl
        border border-slate-800/60 shadow-2xl shadow-black/25
        ${className}
      `}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Header */}
      <div className="p-6 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Select Image</h2>
            <p className="text-xs text-slate-400">
              {allowUpload
                ? "Choose from library or upload your own"
                : `Choose a logo from the ${userRole.replace("_", " ")} library`}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {value && (
            <SelectedBanner
              logo={selectedLogo}
              url={value}
              onClear={handleClear}
              showUrl={showUrlInPreview}
              isRemoving={isRemoving}
            />
          )}
        </AnimatePresence>

        {/* Mode Toggle */}
        {allowUpload && onUpload && (
          <div className="mb-5">
            <ModeToggle mode={activeMode} onChange={setActiveMode} allowUpload={allowUpload} />
          </div>
        )}

        {/* Library Controls */}
        <AnimatePresence mode="wait">
          {activeMode === "library" && (
            <motion.div
              key="library-controls"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search logos..."
                  className={`
                    w-full pl-10 pr-4 py-2.5 rounded-xl
                    bg-slate-800/50 border border-slate-700/50
                    text-sm text-white placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40
                    transition-all duration-300
                  `}
                  aria-label="Search logos"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:block">
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-800 border border-slate-700">
                    ⌘K
                  </kbd>
                </div>
              </div>

              {visibleCategories.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide" role="tablist">
                  {visibleCategories.map((cat) => (
                    <CategoryTab
                      key={cat}
                      category={cat}
                      active={activeCategory === cat}
                      onClick={() => setActiveCategory(cat)}
                      count={counts[cat] || 0}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Body */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeMode === "upload" && allowUpload && onUpload ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <UploadZone
                onUpload={handleUpload}
                isUploading={isUploading}
                maxFileSize={maxFileSize}
                acceptedTypes={acceptedTypes}
              />
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {filtered.length > 0 ? (
                <motion.div
                  layout
                  className="grid gap-3.5"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {filtered.map((logo, i) => (
                      <LogoCard
                        key={logo.id}
                        logo={logo}
                        selected={value === logo.url}
                        onClick={() => onSelect(logo)}
                        index={i}
                        focused={focusedIndex === i}
                        onFocus={() => setFocusedIndex(i)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <EmptyState query={debouncedSearch} message={emptyMessage} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
        <span aria-live="polite">
          {activeMode === "library" && activeCategory
            ? `${filtered.length} logo${filtered.length !== 1 ? "s" : ""} in ${
                CATEGORY_META[activeCategory].label
              }`
            : activeMode === "upload"
            ? "Images are optimized and delivered via Cloudinary CDN"
            : "..."}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeMode === "library" ? "Click or press Enter to select" : "Drag & drop supported"}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// FORM HOOK (Updated for dual-path)
// =============================================================================

export function useLogoField(
  userRole: UserRole,
  initialUrl?: string | null
) {
  const [selected, setSelected] = useState<Logo | null>(
    initialUrl ? { id: "", url: initialUrl, name: "", category: "player" } : null
  );

  const handleSelect = useCallback((logo: Logo) => {
    setSelected(logo.url ? logo : null);
  }, []);

  const clear = useCallback(() => {
    setSelected(null);
  }, []);

  return {
    value: selected?.url || null,
    logo: selected,
    onSelect: handleSelect,
    clear,
  };
}

export default LogoSelector;