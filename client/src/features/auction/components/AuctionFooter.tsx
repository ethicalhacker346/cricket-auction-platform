import { Radio, Server, Wifi, Loader2 } from "lucide-react";
import { useAuctionSocket } from "@/features/auction/hooks/index.hook";
import { formatClockTime } from "@/features/auction/utils/index.utils";
import { ConnectionDot } from "./Badges";

export function AuctionFooter() {
  const { connection, latencyMs, isConnected } = useAuctionSocket();

  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-950/60 px-4 py-2.5 text-[11px] text-slate-500 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <ConnectionDot connection={connection} />
          <span className="hidden sm:inline">Realtime Engine</span>
          <span className="capitalize text-slate-400">{connection}</span>
          {!isConnected && connection === "connecting" && (
            <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          )}
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Wifi className="h-3 w-3" />
          {latencyMs > 0 ? `${latencyMs}ms` : "—"}
        </span>
        <span className="hidden items-center gap-1.5 md:flex">
          <Server className="h-3 w-3" />
          {formatClockTime()}
        </span>
      </div>
      <span className="flex items-center gap-1.5">
        <Radio className="h-3 w-3" />
        <span className="hidden sm:inline">Auction Engine</span> v1.0
      </span>
    </footer>
  );
}
