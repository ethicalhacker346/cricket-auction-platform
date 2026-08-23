import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, ChevronLeft, Gavel, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import {
  useAuctionViewerPresence,
  useAuth,
  useLiveAuction,
  useResolvedUserTeam,
} from "@/features/auction/hooks/index.hook";
import { useAuctionContext } from "@/features/auction/hooks/useAuctionContext";
import { AuctionRoutes } from "@/features/auction/routes/auction.routes";
import { SoldUnsoldAnimation } from "@/features/auction/components/SoldUnsoldAnimation";
import { Auction3DErrorBoundary } from "@/features/auction/components/3d/Auction3DErrorBoundary";
import { Auction3DHud } from "@/features/auction/components/3d/Auction3DHud";
import { Auction3DBidDock } from "@/features/auction/components/3d/Auction3DBidDock";
import {
  supportsWebGL,
  useAuction3DPreferences,
} from "@/features/auction/hooks/useAuction3DPreferences";

// Keep Three.js and the renderer out of the normal 2D auction bundle. The
// immersive payload is downloaded only after the user enters this route.
const AuctionArena3D = lazy(
  () => import("@/features/auction/components/3d/AuctionArena3D"),
);

function CenteredGuard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[540px] max-w-3xl items-center justify-center px-5 py-16 text-center">
      {children}
    </div>
  );
}

function WebGLUnavailable({ tournamentId, auctionId }: { tournamentId: string; auctionId: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#02030a] p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(6,182,212,.13),transparent_38%),radial-gradient(circle_at_75%_70%,rgba(139,92,246,.12),transparent_36%)]" />
      <div className="relative max-w-md rounded-[28px] border border-white/10 bg-slate-950/75 p-7 text-center shadow-2xl backdrop-blur-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200 ring-1 ring-amber-300/20">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-xl font-black text-white">3D acceleration is unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Your live connection and bidding console remain active. Enable hardware acceleration or
          use GullyBid&apos;s standard live room on this device.
        </p>
        <Link
          to={AuctionRoutes.live(tournamentId, auctionId)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
        >
          <ChevronLeft className="h-4 w-4" /> Open standard room
        </Link>
      </div>
    </div>
  );
}

function RendererLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#02030a]">
      <div className="text-center">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200">
          <Boxes className="h-6 w-6" />
          <span className="absolute inset-0 animate-ping rounded-2xl border border-cyan-300/20" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300/55">
          Building GullyBid Arena
        </p>
      </div>
    </div>
  );
}

export default function LiveAuction3DPage() {
  const { tournamentId, auctionId } = useAuctionContext();
  const { isAuthenticated, hasHydrated } = useAuth();
  const roomRef = useRef<HTMLDivElement>(null);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(null);
  const [rendererKey, setRendererKey] = useState(0);

  const live = useLiveAuction({ auctionId, tournamentId });
  const teamResolution = useResolvedUserTeam(live.franchises);
  const presenceCount = useAuctionViewerPresence(
    isAuthenticated && auctionId ? auctionId : undefined,
  );
  const preferences = useAuction3DPreferences();

  useEffect(() => {
    setWebGLAvailable(supportsWebGL());
  }, []);

  if (!hasHydrated) {
    return (
      <CenteredGuard>
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
          <p className="mt-3 text-sm font-semibold text-slate-400">Preparing your live session…</p>
        </div>
      </CenteredGuard>
    );
  }

  if (!isAuthenticated) {
    return (
      <CenteredGuard>
        <div>
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-300" />
          <h1 className="mt-4 text-xl font-black text-white">Authentication required</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
            Sign in to enter the immersive auction, watch the floor, and place authorized bids.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110"
          >
            Sign in
          </Link>
        </div>
      </CenteredGuard>
    );
  }

  if (!auctionId || !tournamentId) {
    return (
      <CenteredGuard>
        <div>
          <Gavel className="mx-auto h-12 w-12 text-slate-600" />
          <h1 className="mt-4 text-xl font-black text-white">No active auction context</h1>
          <p className="mt-2 text-sm text-slate-400">Open a tournament auction before entering 3D mode.</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/15">
            Go to dashboard
          </Link>
        </div>
      </CenteredGuard>
    );
  }

  const permissions = teamResolution.permissions;
  const viewerCount = live.viewerCount || presenceCount || 0;

  return (
    <div
      ref={roomRef}
      className="relative isolate h-[calc(100dvh-6rem)] min-h-[620px] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#02030a] shadow-[0_30px_120px_rgba(0,0,0,.45)] fullscreen:h-screen fullscreen:min-h-0 fullscreen:rounded-none fullscreen:border-0"
    >
      <SoldUnsoldAnimation />

      {webGLAvailable === null ? (
        <RendererLoading />
      ) : webGLAvailable ? (
        <Auction3DErrorBoundary
          key={rendererKey}
          onRetry={() => setRendererKey((value) => value + 1)}
        >
          <Suspense fallback={<RendererLoading />}>
            <AuctionArena3D
              player={live.currentPlayer}
              franchises={live.franchises}
              leadingFranchise={live.leadingFranchise}
              currentBid={live.currentBid}
              timer={live.timer}
              status={live.status}
              soldSequence={live.soldEvent?.seq}
              unsoldSequence={live.unsoldEvent?.seq}
              cameraMode={preferences.cameraMode}
              quality={preferences.quality}
              renderConfig={preferences.renderConfig}
              reducedMotion={preferences.reducedMotion}
              pageVisible={preferences.pageVisible}
            />
          </Suspense>
        </Auction3DErrorBoundary>
      ) : (
        <WebGLUnavailable tournamentId={tournamentId} auctionId={auctionId} />
      )}

      <Auction3DHud
        tournamentId={tournamentId}
        auctionId={auctionId}
        player={live.currentPlayer}
        players={live.players}
        franchises={live.franchises}
        leadingFranchise={live.leadingFranchise}
        userTeam={teamResolution.franchise}
        currentBid={live.currentBid}
        timer={live.timer}
        status={live.status}
        connection={live.connection}
        latencyMs={live.serverLatencyMs}
        viewerCount={viewerCount}
        currentRound={live.currentRound}
        rounds={live.rounds}
        upcomingPlayers={live.upcomingPlayers}
        bidHistory={live.bidHistory}
        logs={live.logs}
        soldCount={live.playersSoldCount ?? 0}
        unsoldCount={(live.playersUnsoldCount ?? 0) + (live.playersPermanentUnsoldCount ?? 0)}
        totalMoneySpent={live.totalMoneySpent ?? 0}
        permissions={permissions}
        quality={preferences.quality}
        onQualityChange={preferences.setQuality}
        cameraMode={preferences.cameraMode}
        onCameraModeChange={preferences.setCameraMode}
        fullscreenTarget={roomRef}
      />

      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
        <Auction3DBidDock
          auctionId={auctionId}
          player={live.currentPlayer}
          players={live.players}
          userTeam={teamResolution.franchise}
          currentBid={live.currentBid}
          timer={live.timer}
          status={live.status}
          connection={live.connection}
          permissions={permissions}
        />
      </div>

      {(live.connection === "offline" || live.connection === "reconnecting") && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-[76px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold text-amber-100 shadow-xl backdrop-blur-xl"
        >
          <WifiOff className="h-3.5 w-3.5" />
          {live.connection === "offline" ? "Connection lost — bids are locked while we retry" : "Rejoining the live floor…"}
        </div>
      )}
    </div>
  );
}
