import type { LiveAuctionSnapshot } from '@/features/auction/types/index.types';
import { auctionEventBus } from './EventBus';
import type { AuctionSoundEvent } from './types';

export class StateDiffEmitter {
  private initialized = false;
  private last = {
    currentBidAmount: 0,
    currentBidTeamId: null as string | null,
    currentPlayerId: null as string | null,
    auctionStatus: '' as string,
    soldSeq: -1,
    unsoldSeq: -1,
  };
  private completedRounds = new Set<string>();

  emit(snapshot: LiveAuctionSnapshot) {
    // On first emit we only seed state; no sounds on initial hydration.
    if (!this.initialized) {
      this.seed(snapshot);
      this.initialized = true;
      return;
    }

    const events: AuctionSoundEvent[] = [];
    const auctionId = snapshot.auction?.id ?? 'unknown';

    // ── LOT OPENED ──
    if (snapshot.currentPlayerId && snapshot.currentPlayerId !== this.last.currentPlayerId) {
      const player = snapshot.players.find((p) => p.id === snapshot.currentPlayerId);
      events.push({
        type: 'LOT_OPENED',
        meta: { id: `lot_${snapshot.currentPlayerId}`, timestamp: Date.now(), auctionId },
        payload: { playerName: player?.name || 'Unknown' },
      });
      // Reset bid baseline so the first bid on this lot registers correctly
      this.last.currentBidAmount = 0;
      this.last.currentBidTeamId = null;
    }

    // ── BID PLACED ──
    // Only fire if we're on the same lot and the bid materially changed
    if (
      snapshot.currentPlayerId &&
      snapshot.currentPlayerId === this.last.currentPlayerId &&
      snapshot.currentBid.amount > 0 &&
      (snapshot.currentBid.amount !== this.last.currentBidAmount ||
        snapshot.currentBid.teamId !== this.last.currentBidTeamId)
    ) {
      const franchise = snapshot.franchises.find((f) => f.id === snapshot.currentBid.teamId);
      events.push({
        type: 'BID_PLACED',
        meta: {
          id: `bid_${snapshot.currentBid.teamId}_${snapshot.currentBid.amount}_${Date.now()}`,
          timestamp: Date.now(),
          auctionId,
        },
        payload: {
          amount: snapshot.currentBid.amount,
          teamName: franchise?.shortName || 'Unknown',
          isFirstBid: this.last.currentBidAmount === 0,
        },
      });
    }

    // ── SOLD ──
    if (snapshot.soldEvent && snapshot.soldEvent.seq !== this.last.soldSeq) {
      const player = snapshot.players.find((p) => p.id === snapshot.soldEvent?.playerId);
      const franchise = snapshot.franchises.find((f) => f.id === snapshot.soldEvent?.teamId);
      events.push({
        type: 'LOT_SOLD',
        meta: { id: `sold_${snapshot.soldEvent.seq}`, timestamp: Date.now(), auctionId },
        payload: {
          playerName: player?.name || '',
          teamName: franchise?.name || '',
          amount: snapshot.soldEvent.amount,
        },
      });
    }

    // ── UNSOLD ──
    if (snapshot.unsoldEvent && snapshot.unsoldEvent.seq !== this.last.unsoldSeq) {
      const player = snapshot.players.find((p) => p.id === snapshot.unsoldEvent?.playerId);
      events.push({
        type: 'LOT_UNSOLD',
        meta: { id: `unsold_${snapshot.unsoldEvent.seq}`, timestamp: Date.now(), auctionId },
        payload: { playerName: player?.name || '' },
      });
    }

    // ── AUCTION LIFECYCLE ──
    if (snapshot.auction?.status !== this.last.auctionStatus) {
      const status = snapshot.auction?.status;
      const meta = { id: `status_${status}_${Date.now()}`, timestamp: Date.now(), auctionId };
      if (status === 'live') {
        events.push({
          type: this.last.auctionStatus === 'paused' ? 'AUCTION_RESUMED' : 'AUCTION_STARTED',
          meta,
        });
      } else if (status === 'paused') {
        events.push({ type: 'AUCTION_PAUSED', meta });
      }
    }

    // ── ROUND COMPLETED ──
    snapshot.rounds.forEach((r) => {
      if (r.status === 'completed' && !this.completedRounds.has(r.id)) {
        this.completedRounds.add(r.id);
        events.push({
          type: 'ROUND_COMPLETED',
          meta: { id: `round_${r.id}`, timestamp: Date.now(), auctionId },
          payload: { roundName: r.name },
        });
      }
    });

    // Commit last state
    this.seed(snapshot);

    // Fire events
    events.forEach((e) => auctionEventBus.emit(e));
  }

  private seed(snapshot: LiveAuctionSnapshot) {
    this.last = {
      currentBidAmount: snapshot.currentBid.amount,
      currentBidTeamId: snapshot.currentBid.teamId,
      currentPlayerId: snapshot.currentPlayerId,
      auctionStatus: snapshot.auction?.status || '',
      soldSeq: snapshot.soldEvent?.seq ?? this.last.soldSeq,
      unsoldSeq: snapshot.unsoldEvent?.seq ?? this.last.unsoldSeq,
    };
  }

  reset() {
    this.initialized = false;
    this.completedRounds.clear();
  }
}