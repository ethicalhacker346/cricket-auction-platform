import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Share2, X, Check, Crown, Loader2 } from "lucide-react";
import type { Franchise, Player } from "@/features/auction/types/index.types";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

/* =============================================================================
   TYPES
   ============================================================================= */
interface TopBuyShareCardProps {
  player: Player;
  franchise?: Franchise;
  /** Average sold price across the auction, shown for context on the card. */
  avgSoldPrice?: number;
  /** Optional tournament name, shown as an eyebrow on the share card. */
  tournamentName?: string;
  /** Link included in the share text/caption. Defaults to the current page URL. */
  shareUrl?: string;
}

/* =============================================================================
   SHARE PREVIEW CARD (this is the DOM node captured into the shared image)
   ============================================================================= */
function SharePreviewCard({
  player,
  franchise,
  avgSoldPrice,
  tournamentName,
  innerRef,
}: {
  player: Player;
  franchise?: Franchise;
  avgSoldPrice?: number;
  tournamentName?: string;
  innerRef: React.RefObject<HTMLDivElement>;
}) {
  const multiplier =
    player.basePrice > 0 && player.soldPrice ? (player.soldPrice / player.basePrice).toFixed(1) : null;

  return (
    <div
      ref={innerRef}
      className="relative mx-auto aspect-[4/5] w-full max-w-sm shrink-0 overflow-hidden rounded-3xl"
      style={{
        background: franchise
          ? `linear-gradient(160deg, ${franchise.colorFrom} 0%, #05070c 68%)`
          : "linear-gradient(160deg, #f59e0b 0%, #05070c 68%)",
      }}
    >
      {/* decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-black/30 blur-2xl" />

      <div className="relative flex h-full flex-col p-6 text-white">
        {/* eyebrow row */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-300/30">
            <Crown className="h-3 w-3" /> Top Buy
          </span>
          {tournamentName && (
            <span className="max-w-[55%] truncate text-right text-[10px] font-semibold uppercase tracking-wider text-white/60">
              {tournamentName}
            </span>
          )}
        </div>

        {/* player identity */}
        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative">
            <div className="h-28 w-28 overflow-hidden rounded-2xl shadow-2xl ring-4 ring-white/20">
              {player.profileImage ? (
                <img
                  src={player.profileImage}
                  alt={player.name}
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 text-3xl font-black">
                  {initials(player.name)}
                </div>
              )}
            </div>
            {player.overseas && (
              <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-[13px] shadow-lg ring-2 ring-black/20">
                🌏
              </span>
            )}
          </div>

          <h2 className="mt-4 text-2xl font-black leading-tight">{player.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/70">
            {ROLE_ICONS[player.role] ?? "🏏"} {player.role}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-white/50">
            {player.battingStyle && <span>{player.battingStyle}</span>}
            {player.battingStyle && player.bowlingStyle && <span>·</span>}
            {player.bowlingStyle && <span>{player.bowlingStyle}</span>}
            {player.age > 0 && (
              <>
                <span>·</span>
                <span>{player.age} yrs</span>
              </>
            )}
          </div>

          {/* sold price */}
          <div className="mt-6">
            <p className="text-4xl font-black text-amber-300 drop-shadow-sm">
              {formatLakhs(player.soldPrice ?? 0)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold text-white/50">
              <span>Base {formatLakhs(player.basePrice)}</span>
              {multiplier && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-amber-200">{multiplier}x</span>
              )}
              {avgSoldPrice != null && avgSoldPrice > 0 && <span>Avg {formatLakhs(Math.round(avgSoldPrice))}</span>}
            </div>
          </div>
        </div>

        {/* franchise footer */}
        {franchise && (
          <div className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-bold"
              style={{ background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})` }}
            >
              {franchise.logo ? (
                <img
                  src={franchise.logo}
                  alt={franchise.name}
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(franchise.shortName)
              )}
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-bold text-white">{franchise.name}</p>
              <p className="text-[9px] uppercase tracking-wider text-white/50">Winning franchise</p>
            </div>
          </div>
        )}

        <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Auction Results
        </p>
      </div>
    </div>
  );
}

/* =============================================================================
   TOP BUY SHARE CARD (exported)

   Renders the "Top Buy of the Auction" summary tile with a single Share
   action. Clicking it opens a modal with a shareable image preview and one
   "Share" button that hands off to the device's native share sheet — that's
   where WhatsApp, Facebook, and everything else the person has installed
   shows up, so there's no need to hard-code a button per platform. If the
   Web Share API isn't available at all, it falls back to copying the caption
   and downloading the image so it can still be posted anywhere manually.
   ============================================================================= */
export function TopBuyShareCard({
  player,
  franchise,
  avgSoldPrice,
  tournamentName,
  shareUrl,
}: TopBuyShareCardProps) {
  const [open, setOpen] = useState(false);
  // idle → preparing (capturing the image) → fallback-done (native share isn't
  // available, so we copied the caption + downloaded the image instead)
  const [shareState, setShareState] = useState<"idle" | "preparing" | "fallback-done">("idle");
  const cardRef = useRef<HTMLDivElement>(null);

  const resolvedUrl = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const franchiseName = franchise?.name ?? "an unknown franchise";

  const shareText = useMemo(() => {
    return [
      `🏆 ${player.name} was the Top Buy${tournamentName ? ` of the ${tournamentName}` : ""} Auction!`,
      `Sold to ${franchiseName} for ${formatLakhs(player.soldPrice ?? 0)}.`,
    ].join(" ");
  }, [player.name, player.soldPrice, tournamentName, franchiseName]);

  // Lock page scroll and allow Escape to close while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const captureImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: null,
      useCORS: true,
      logging: false,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 1));
  }, []);

  const downloadBlob = useCallback(
    (blob: Blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${player.name.replace(/\s+/g, "_")}_Top_Buy.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    },
    [player.name]
  );

  /**
   * Single share action. Whichever platform the person wants to post to —
   * WhatsApp, Facebook, Instagram, whatever's installed — is handled by the
   * OS-level share sheet via the Web Share API, so there's no need to hard-code
   * a button per platform. Where that API isn't available at all (some desktop
   * browsers), we fall back to copying the caption and downloading the image so
   * it can still be shared anywhere manually.
   */
  const handleShare = useCallback(async () => {
    if (shareState === "preparing") return;
    setShareState("preparing");
    try {
      const blob = await captureImage();
      const file = blob
        ? new File([blob], `${player.name.replace(/\s+/g, "_")}_Top_Buy.png`, { type: "image/png" })
        : null;

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Top Buy of the Auction", text: shareText });
        setShareState("idle");
        return;
      }

      if (navigator.share) {
        // Image attachment isn't supported here — share text + link instead.
        await navigator.share({ title: "Top Buy of the Auction", text: shareText, url: resolvedUrl });
        setShareState("idle");
        return;
      }

      // No native share support at all: copy the caption and hand over the
      // image so the person can still post it wherever they like.
      await navigator.clipboard.writeText(`${shareText} ${resolvedUrl}`);
      if (blob) downloadBlob(blob);
      setShareState("fallback-done");
      setTimeout(() => setShareState("idle"), 2800);
    } catch (err) {
      // AbortError just means the person dismissed the native share sheet.
      if ((err as Error)?.name !== "AbortError") {
        console.error("Share failed:", err);
      }
      setShareState("idle");
    }
  }, [captureImage, downloadBlob, player.name, resolvedUrl, shareState, shareText]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-400">Top Buy of the Auction</p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 transition hover:bg-amber-400/20"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xl font-black text-white">{player.name}</p>
            <p className="text-xs text-slate-400">
              {player.role} · Sold to {franchiseName}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-emerald-400">{formatLakhs(player.soldPrice ?? 0)}</p>
            {avgSoldPrice != null && (
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Avg: {formatLakhs(Math.round(avgSoldPrice))}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[calc(100vh-3rem)]"
                >
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close share dialog"
                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
                    <p className="mb-4 text-center text-sm font-bold text-white">Share this Top Buy</p>

                    <div
                      className="flex min-h-0 flex-1 items-center justify-center"
                      style={{ width: "min(100%, calc((100vh - 12rem) * 0.8))", alignSelf: "center" }}
                    >
                      <SharePreviewCard
                        player={player}
                        franchise={franchise}
                        avgSoldPrice={avgSoldPrice}
                        tournamentName={tournamentName}
                        innerRef={cardRef}
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleShare}
                      disabled={shareState === "preparing"}
                      className={cn(
                        "mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
                        shareState === "preparing"
                          ? "cursor-not-allowed bg-white/5 text-slate-500"
                          : shareState === "fallback-done"
                          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                          : "bg-amber-400 text-slate-950 hover:brightness-110"
                      )}
                    >
                      {shareState === "preparing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : shareState === "fallback-done" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                      {shareState === "preparing"
                        ? "Preparing…"
                        : shareState === "fallback-done"
                        ? "Caption copied & image downloaded"
                        : "Share"}
                    </motion.button>

                    <p className="mt-2 text-center text-[10px] text-slate-500">
                      Opens your device's share menu — pick WhatsApp, Facebook, or anywhere else.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}