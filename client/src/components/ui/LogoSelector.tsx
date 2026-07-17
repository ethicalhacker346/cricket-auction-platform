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
} from "lucide-react";
import type { Logo, LogoCategory } from "./logoLibrary";

// =============================================================================
// TYPES
// =============================================================================

export type UserRole = "player" | "franchise_owner" | "organizer" | "admin";

export interface LogoSelectorProps {
  userRole: UserRole;
  value?: string | null;
  onChange: (logo: Logo) => void;
  logos: Logo[];
  className?: string;
  /** Debounce search input in ms */
  searchDebounceMs?: number;
  /** Number of columns in grid (responsive override) */
  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  /** Show logo URL in preview banner */
  showUrlInPreview?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** ARIA label for the selector region */
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

// =============================================================================
// HOOKS
// =============================================================================

/** Debounce any value */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Preload images for instant perceived performance */
function usePreloadImages(urls: string[]) {
  useEffect(() => {
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [urls]);
}

/** Measure grid columns from container width */
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
  onClear,
  showUrl,
}: {
  logo: Logo;
  onClear: () => void;
  showUrl?: boolean;
}) {
  const meta = CATEGORY_META[logo.category];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="overflow-hidden"
    >
      <div className="relative p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-900/60 border border-slate-700/50 p-2 flex items-center justify-center shrink-0">
            <img
              src={logo.url}
              alt={logo.name}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{logo.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 ${meta.accent}`}>
                {logo.category}
              </span>
            </div>
            {showUrl && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{logo.url}</p>
            )}
          </div>
          <button
            onClick={onClear}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
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
  onChange,
  logos,
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

  // Preload visible logos for instant feel
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

  // Selected logo object
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
            onChange(filtered[focusedIndex]);
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
  }, [filtered, focusedIndex, gridCols, onChange]);

  const handleClear = useCallback(() => {
    onChange({ id: "", url: "", name: "", category: "player" });
  }, [onChange]);

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
            <h2 className="text-base font-bold text-white">Select Logo</h2>
            <p className="text-xs text-slate-400">
              Choose a logo from the {userRole.replace("_", " ")} library
            </p>
          </div>
        </div>

        <AnimatePresence>
          {selectedLogo && selectedLogo.url && (
            <SelectedBanner
              logo={selectedLogo}
              onClear={handleClear}
              showUrl={showUrlInPreview}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
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

          {/* Tabs */}
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
        </div>
      </div>

      {/* Grid */}
      <div className="p-6" ref={gridRef}>
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
                  onClick={() => {
                    onChange(logo);
                    setFocusedIndex(i);
                  }}
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
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
        <span aria-live="polite">
          {filtered.length} logo{filtered.length !== 1 ? "s" : ""} in{" "}
          {activeCategory ? CATEGORY_META[activeCategory].label : "..."}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Click or press Enter to select
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// FORM HOOK (Optional convenience)
// =============================================================================

export function useLogoField(
  userRole: UserRole,
  initialUrl?: string | null
) {
  const [selected, setSelected] = useState<Logo | null>(
    initialUrl ? { id: "", url: initialUrl, name: "", category: "player" } : null
  );

  const handleChange = useCallback((logo: Logo) => {
    setSelected(logo.url ? logo : null);
  }, []);

  return {
    value: selected?.url || null,
    logo: selected,
    onChange: handleChange,
    clear: () => setSelected(null),
  };
}

export default LogoSelector;