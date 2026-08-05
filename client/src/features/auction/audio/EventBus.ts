// features/auction/audio/EventBus.ts
import type { AuctionSoundEvent } from "./types";

type Handler<E extends AuctionSoundEvent> = (event: E) => void;

export class AuctionEventBus {
  private handlers = new Map<string, Set<Handler<any>>>();

  // Wildcard overload
  on(type: "*", handler: Handler<AuctionSoundEvent>): () => void;
  // Typed overload
  on<T extends AuctionSoundEvent["type"]>(
    type: T,
    handler: Handler<Extract<AuctionSoundEvent, { type: T }>>,
  ): () => void;
  // Implementation
  on(type: string, handler: Handler<any>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  emit(event: AuctionSoundEvent): void {
    // Specific handlers first
    this.handlers.get(event.type)?.forEach((h) => {
      try {
        h(event);
      } catch (e) {
        /* sink */
      }
    });
    // Wildcard handlers second
    this.handlers.get("*")?.forEach((h) => {
      try {
        h(event);
      } catch (e) {
        /* sink */
      }
    });
  }
}

export const auctionEventBus = new AuctionEventBus();
