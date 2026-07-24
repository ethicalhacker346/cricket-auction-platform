import { Radio, Wifi, Loader2, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuctionSocket, useAuctionViewerPresence } from "@/features/auction/hooks/index.hook";
import { formatClockTime } from "@/features/auction/utils/index.utils";
import { ConnectionDot } from "./Badges";

/** Ticks once a second so the footer's clock is actually live, not a value
 *  frozen at whatever moment this component happened to render. */
function useLiveClock() {
  const [now, setNow] = useState(() => formatClockTime());
  useEffect(() => {
    const id = setInterval(() => setNow(formatClockTime()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Divider() {
  return <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />;
}

export function AuctionFooter({ auctionId }: { auctionId?: string }) {
  const { connection, latencyMs, isConnected } = useAuctionSocket(auctionId ? { auctionId } : undefined);
  const viewerCount = useAuctionViewerPresence(auctionId);
  const clock = useLiveClock();

  const hasLatency = Number.isFinite(latencyMs) && latencyMs > 0;

  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-white/10 bg-slate-950/80 px-3 py-2.5 text-[11px] text-slate-500 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4">
        {/* Connection — always visible, this is the one thing worth knowing
            no matter how narrow the viewport gets. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <ConnectionDot connection={connection} />
          <span className="hidden text-slate-400 sm:inline">Realtime Engine</span>
          <span className="capitalize text-slate-300">{connection}</span>
          {!isConnected && connection === "connecting" && (
            <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          )}
        </span>

        <Divider />

        {/* Latency */}
        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Wifi className="h-3 w-3" />
          {hasLatency ? `${latencyMs}ms` : "—"}
        </span>

        <Divider />

        {/* Live clock */}
        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          <Clock className="h-3 w-3" />
          <span className="font-mono tabular-nums">{clock}</span>
        </span>

        <Divider />

        {/* Viewers — reserves its slot even before the first heartbeat
            resolves, so the footer doesn't visibly shift width once it does. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <Users className="h-3 w-3" />
          <span className="tabular-nums">{viewerCount ?? "—"}</span>
          <span className="hidden sm:inline">watching</span>
        </span>
      </div>

      <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
        <Radio className="h-3 w-3" />
        <span className="hidden sm:inline">Auction Engine</span>
        <span className="font-mono">v1.0</span>
      </span>
    </footer>
  );
}