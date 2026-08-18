import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Share2, X, Check, Crown, Loader2, AlertCircle } from "lucide-react";
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

type ShareState =
  | "idle"
  | "preparing"
  | "ready"
  | "fallback-done"
  | "error";

/* =============================================================================
   SHARE PREVIEW CARD
   =============================================================================
   The fallback content is always rendered underneath the images. If an external
   image cannot be safely rendered by html2canvas because of CORS, the capture
   retry can ignore the image and still produce a complete share card.
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
    player.basePrice > 0 && player.soldPrice
      ? (player.soldPrice / player.basePrice).toFixed(1)
      : null;

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
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-black/30 blur-2xl" />

      <div className="relative flex h-full flex-col p-6 text-white">
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

        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative">
            <div className="h-28 w-28 overflow-hidden rounded-2xl bg-white/10 shadow-2xl ring-4 ring-white/20">
              {/* Always-rendered fallback. It remains available if capture has to
                  ignore a CORS-protected image. */}
              <div className="flex h-full w-full items-center justify-center bg-white/10 text-3xl font-black">
                {initials(player.name)}
              </div>

              {player.profileImage && (
                <img
                  src={player.profileImage}
                  alt=""
                  crossOrigin="anonymous"
                  data-share-image="player"
                  className="absolute inset-0 h-full w-full object-cover"
                />
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

          <div className="mt-6">
            <p className="text-4xl font-black text-amber-300 drop-shadow-sm">
              {formatLakhs(player.soldPrice ?? 0)}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold text-white/50">
              <span>Base {formatLakhs(player.basePrice)}</span>

              {multiplier && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-amber-200">
                  {multiplier}x
                </span>
              )}

              {avgSoldPrice != null && avgSoldPrice > 0 && (
                <span>Avg {formatLakhs(Math.round(avgSoldPrice))}</span>
              )}
            </div>
          </div>
        </div>

        {franchise && (
          <div className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
            <span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
              }}
            >
              {/* Fallback remains visible whenever the logo is excluded from a
                  retry capture. */}
              <span>{initials(franchise.shortName)}</span>

              {franchise.logo && (
                <img
                  src={franchise.logo}
                  alt=""
                  crossOrigin="anonymous"
                  data-share-image="franchise"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </span>

            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-bold text-white">
                {franchise.name}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-white/50">
                Winning franchise
              </p>
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
   TOP BUY SHARE CARD
   =============================================================================
   Important implementation detail:

   navigator.share() requires transient user activation. Waiting for html2canvas
   inside the Share button handler can consume that activation before the native
   share call is reached. The image is therefore prepared when the modal opens.
   The actual Share button only hands an already-created File to navigator.share().
   ============================================================================= */

export function TopBuyShareCard({
  player,
  franchise,
  avgSoldPrice,
  tournamentName,
  shareUrl,
}: TopBuyShareCardProps) {
  const [open, setOpen] = useState(false);
  const [shareState, setShareState] = useState<ShareState>("idle");

  const cardRef = useRef<HTMLDivElement>(null);
  const preparedFileRef = useRef<File | null>(null);
  const preparedBlobRef = useRef<Blob | null>(null);
  const prepareRunRef = useRef(0);

  const resolvedUrl =
    shareUrl ??
    (typeof window !== "undefined" ? window.location.href : "");

  const franchiseName = franchise?.name ?? "an unknown franchise";

  const shareText = useMemo(() => {
    return [
      `🏆 ${player.name} was the Top Buy${
        tournamentName ? ` of the ${tournamentName}` : ""
      } Auction!`,
      `Sold to ${franchiseName} for ${formatLakhs(
        player.soldPrice ?? 0
      )}.`,
    ].join(" ");
  }, [
    player.name,
    player.soldPrice,
    tournamentName,
    franchiseName,
  ]);

  /* ---------------------------------------------------------------------------
     Page scroll / Escape handling
     --------------------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /* ---------------------------------------------------------------------------
     Image readiness

     html2canvas can clone the card before an external image has finished
     loading. We explicitly wait for current images, but do not let a failed
     external image block the whole capture.
     --------------------------------------------------------------------------- */

  const waitForImages = useCallback(async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll("img[data-share-image]"));

    if (images.length === 0) return;

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }

            const done = () => {
              img.removeEventListener("load", done);
              img.removeEventListener("error", done);
              resolve();
            };

            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });

            // Never allow a bad remote image to keep the share button blocked.
            window.setTimeout(done, 5000);
          })
      )
    );
  }, []);

  /* ---------------------------------------------------------------------------
     Canvas -> Blob

     toBlob() can theoretically return null. Treat that as a real failure instead
     of silently continuing with a null file.
     --------------------------------------------------------------------------- */

  const canvasToBlob = useCallback((canvas: HTMLCanvasElement) => {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas could not be converted to PNG."));
          }
        },
        "image/png"
      );
    });
  }, []);

  /* ---------------------------------------------------------------------------
     Capture

     First attempt: capture with images.

     If an image causes a CORS/security problem, retry once while ignoring only
     the external share images. The initials fallbacks remain in the card, so the
     resulting image is still complete and usable.
     --------------------------------------------------------------------------- */

  const captureImage = useCallback(
    async (withoutExternalImages = false): Promise<Blob> => {
      if (!cardRef.current) {
        throw new Error("Share preview is not mounted.");
      }

      const { default: html2canvas } = await import("html2canvas");

      await waitForImages(cardRef.current);

      const deviceScale =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

      const scale = Math.min(Math.max(deviceScale, 1), 2);

      const canvas = await html2canvas(cardRef.current, {
        scale,
        backgroundColor: null,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 5000,
        logging: false,
        removeContainer: true,
        scrollX: 0,
        scrollY: 0,

        ...(withoutExternalImages
          ? {
              ignoreElements: (element: Element) =>
                element instanceof HTMLImageElement &&
                element.hasAttribute("data-share-image"),
            }
          : {}),
      });

      return canvasToBlob(canvas);
    },
    [canvasToBlob, waitForImages]
  );

  /* ---------------------------------------------------------------------------
     Prepare image BEFORE the Share button is clicked.

     This is the critical fix for Web Share API transient activation:
     navigator.share() must be reached from the actual user activation. We do
     the expensive html2canvas work while the modal is open instead.
     --------------------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;

    const runId = ++prepareRunRef.current;

    preparedFileRef.current = null;
    preparedBlobRef.current = null;
    setShareState("preparing");

    let cancelled = false;

    const prepare = async () => {
      try {
        let blob: Blob;

        try {
          blob = await captureImage(false);
        } catch (firstError) {
          console.warn(
            "TopBuyShareCard: image capture with external images failed; retrying without external images.",
            firstError
          );

          blob = await captureImage(true);
        }

        if (cancelled || runId !== prepareRunRef.current) return;

        const safeName =
          `${player.name.replace(/[^\w.-]+/g, "_")}_Top_Buy.png`;

        preparedBlobRef.current = blob;
        preparedFileRef.current = new File([blob], safeName, {
          type: "image/png",
        });

        setShareState("ready");
      } catch (error) {
        if (cancelled || runId !== prepareRunRef.current) return;

        preparedBlobRef.current = null;
        preparedFileRef.current = null;

        console.error("TopBuyShareCard: image preparation failed:", error);
        setShareState("error");
      }
    };

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [captureImage, open, player.name]);

  /* ---------------------------------------------------------------------------
     Download fallback
     --------------------------------------------------------------------------- */

  const downloadBlob = useCallback(
    (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download =
        `${player.name.replace(/[^\w.-]+/g, "_")}_Top_Buy.png`;
      link.rel = "noopener";

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Keep the object URL alive long enough for the browser to consume the
      // synthetic download click.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    },
    [player.name]
  );

  /* ---------------------------------------------------------------------------
     Clipboard fallback

     Clipboard is best-effort. A clipboard failure must NOT prevent image
     download.
     --------------------------------------------------------------------------- */

  const copyShareText = useCallback(async () => {
    const text = `${shareText} ${resolvedUrl}`.trim();

    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("TopBuyShareCard: clipboard write failed:", error);
      return false;
    }
  }, [resolvedUrl, shareText]);

  /* ---------------------------------------------------------------------------
     Share

     The function intentionally does NOT await image generation. The image was
     already prepared when the modal opened. This keeps navigator.share() tied
     directly to the button's transient user activation.
     --------------------------------------------------------------------------- */

  const handleShare = useCallback(async () => {
    if (shareState !== "ready") {
      return;
    }

    const file = preparedFileRef.current;
    const blob = preparedBlobRef.current;

    if (!file || !blob) {
      setShareState("error");
      console.error("TopBuyShareCard: share file is not prepared.");
      return;
    }

    /* File sharing first. canShare() is synchronous and navigator.share() is
       called directly from this click handler. */
    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "Top Buy of the Auction",
          text: shareText,
        });

        setShareState("ready");
        return;
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        setShareState("ready");
        return;
      }

      console.warn(
        "TopBuyShareCard: native file sharing failed; trying text/link sharing.",
        error
      );
    }

    /* If file sharing is unavailable, try normal Web Share with text + URL. */
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Top Buy of the Auction",
          text: shareText,
          url: resolvedUrl,
        });

        setShareState("ready");
        return;
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        setShareState("ready");
        return;
      }

      console.warn(
        "TopBuyShareCard: native text sharing failed; using manual fallback.",
        error
      );
    }

    /* Final fallback: clipboard and image download are independent operations.
       A clipboard failure must never stop the download. */
    await copyShareText();
    downloadBlob(blob);

    setShareState("fallback-done");

    window.setTimeout(() => {
      setShareState((current) =>
        current === "fallback-done" ? "ready" : current
      );
    }, 2800);
  }, [
    copyShareText,
    downloadBlob,
    resolvedUrl,
    shareState,
    shareText,
  ]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setShareState("idle");
    preparedFileRef.current = null;
    preparedBlobRef.current = null;
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-400">
            Top Buy of the Auction
          </p>

          <button
            type="button"
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
            <p className="text-2xl font-black text-emerald-400">
              {formatLakhs(player.soldPrice ?? 0)}
            </p>

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
                onClick={closeModal}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.97 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 28,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[calc(100vh-3rem)]"
                >
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close share dialog"
                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
                    <p className="mb-4 text-center text-sm font-bold text-white">
                      Share this Top Buy
                    </p>

                    <div
                      className="flex min-h-0 flex-1 items-center justify-center"
                      style={{
                        width:
                          "min(100%, calc((100vh - 12rem) * 0.8))",
                        alignSelf: "center",
                      }}
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
                      type="button"
                      whileHover={{
                        scale: shareState === "ready" ? 1.01 : 1,
                      }}
                      whileTap={{
                        scale: shareState === "ready" ? 0.98 : 1,
                      }}
                      onClick={() => void handleShare()}
                      disabled={
                        shareState === "preparing" ||
                        shareState === "error"
                      }
                      className={cn(
                        "mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
                        shareState === "preparing"
                          ? "cursor-wait bg-white/5 text-slate-500"
                          : shareState === "error"
                          ? "cursor-not-allowed bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
                          : shareState === "fallback-done"
                          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                          : "bg-amber-400 text-slate-950 hover:brightness-110"
                      )}
                    >
                      {shareState === "preparing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : shareState === "error" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : shareState === "fallback-done" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}

                      {shareState === "preparing"
                        ? "Preparing image…"
                        : shareState === "error"
                        ? "Image preparation failed"
                        : shareState === "fallback-done"
                        ? "Caption copied & image downloaded"
                        : "Share"}
                    </motion.button>

                    <p className="mt-2 text-center text-[10px] text-slate-500">
                      {shareState === "preparing"
                        ? "Preparing the share image. This may take a moment."
                        : shareState === "error"
                        ? "Close this dialog and try Share again."
                        : "Opens your device's share menu — pick WhatsApp, Facebook, or anywhere else."}
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