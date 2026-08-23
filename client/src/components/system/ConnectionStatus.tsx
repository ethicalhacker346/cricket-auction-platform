import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, RefreshCw, WifiOff } from "lucide-react";

export type GullyBidConnectionState = "online" | "offline" | "reconnecting";

const listeners = new Set<() => void>();
let appState: GullyBidConnectionState = "online";

const emit = () => listeners.forEach((listener) => listener());

const getSnapshot = (): GullyBidConnectionState =>
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : appState;

const getServerSnapshot = (): GullyBidConnectionState => "online";

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (typeof window !== "undefined") {
    window.addEventListener("online", emit);
    window.addEventListener("offline", emit);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", emit);
      window.removeEventListener("offline", emit);
    }
  };
}

/**
 * Lets REST/socket infrastructure publish a GullyBid-specific connection state
 * without coupling the global status UI to a particular API client.
 *
 * Example from a socket/API layer:
 *   setGullyBidConnectionState("reconnecting");
 *   setGullyBidConnectionState("online");
 */
export function setGullyBidConnectionState(state: GullyBidConnectionState) {
  if (appState === state) return;
  appState = state;
  emit();
}

export function useGullyBidConnectionState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type ConnectionStatusProps = {
  /** Optional label override for the live-auction context. */
  context?: "app" | "auction";
};

export default function ConnectionStatus({ context = "app" }: ConnectionStatusProps) {
  const connectionState = useGullyBidConnectionState();
  const shouldReduceMotion = useReducedMotion();
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  const state: GullyBidConnectionState = connectionState;

  const copy = useMemo(() => {
    if (state === "offline") {
      return context === "auction"
        ? {
            title: "Connection lost",
            message: "Live auction updates and bidding are temporarily unavailable.",
          }
        : {
            title: "You're offline",
            message: "Some information may be outdated until your connection returns.",
          };
    }

    if (state === "reconnecting") {
      return {
        title: "Reconnecting",
        message:
          context === "auction"
            ? "Restoring your live auction connection…"
            : "Restoring your connection…",
      };
    }

    return {
      title: "Connection restored",
      message:
        context === "auction"
          ? "Live auction connection restored. Syncing the latest state…"
          : "You're back online. Syncing the latest information…",
    };
  }, [context, state]);

  useEffect(() => {
    if (state === "offline") {
      wasOffline.current = true;
      setShowRestored(false);
      return;
    }

    if (state === "reconnecting") {
      wasOffline.current = true;
      setShowRestored(false);
      return;
    }

    if (!wasOffline.current) return;

    wasOffline.current = false;
    setShowRestored(true);

    const timer = window.setTimeout(() => setShowRestored(false), 2600);
    return () => window.clearTimeout(timer);
  }, [state]);

  const isVisible = state !== "online" || showRestored;
  const visibleState: GullyBidConnectionState = showRestored ? "online" : state;

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          key={visibleState}
          role={visibleState === "offline" ? "alert" : "status"}
          aria-live={visibleState === "offline" ? "assertive" : "polite"}
          initial={{ height: 0, opacity: 0, y: -8 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -8 }}
          transition={{
            duration: shouldReduceMotion ? 0.01 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative z-[100] w-full overflow-hidden"
        >
          <div
            className={[
              "relative border-b px-3 py-2 shadow-sm backdrop-blur-xl",
              visibleState === "offline"
                ? "border-red-300/20 bg-red-950/95 text-red-50"
                : visibleState === "reconnecting"
                  ? "border-amber-300/20 bg-amber-950/95 text-amber-50"
                  : "border-emerald-300/20 bg-emerald-950/95 text-emerald-50",
            ].join(" ")}
          >
            <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-center gap-3 sm:px-2">
              <div
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  visibleState === "offline"
                    ? "border-red-300/20 bg-red-400/10"
                    : visibleState === "reconnecting"
                      ? "border-amber-300/20 bg-amber-400/10"
                      : "border-emerald-300/20 bg-emerald-400/10",
                ].join(" ")}
              >
                {visibleState === "offline" && <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
                {visibleState === "reconnecting" && (
                  <RefreshCw
                    className={shouldReduceMotion ? "h-3.5 w-3.5" : "h-3.5 w-3.5 animate-spin"}
                    aria-hidden="true"
                  />
                )}
                {visibleState === "online" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <p className="inline text-[12px] font-bold tracking-[0.01em] sm:text-[13px]">
                  {copy.title}
                </p>
                <span className="mx-2 hidden text-white/25 sm:inline" aria-hidden="true">
                  •
                </span>
                <p className="inline text-[11px] font-medium leading-5 text-white/70 sm:text-[12px]">
                  {copy.message}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}