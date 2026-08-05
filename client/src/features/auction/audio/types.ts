export interface SoundEventMeta {
  id: string;
  timestamp: number;
  auctionId: string;
}

export type AuctionSoundEvent =
  | { type: 'LOT_OPENED';     meta: SoundEventMeta; payload: { playerName: string } }
  | { type: 'BID_PLACED';     meta: SoundEventMeta; payload: { amount: number; teamName: string; isFirstBid: boolean } }
  | { type: 'LOT_SOLD';       meta: SoundEventMeta; payload: { playerName: string; teamName: string; amount: number } }
  | { type: 'LOT_UNSOLD';     meta: SoundEventMeta; payload: { playerName: string } }
  | { type: 'AUCTION_STARTED';meta: SoundEventMeta }
  | { type: 'AUCTION_PAUSED'; meta: SoundEventMeta }
  | { type: 'AUCTION_RESUMED';meta: SoundEventMeta }
  | { type: 'ROUND_COMPLETED';meta: SoundEventMeta; payload: { roundName: string } }
  | { type: 'TIMER_TICK';     meta: SoundEventMeta; payload: { remaining: number; urgency: 'normal' | 'fast' | 'final' } };