import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { useAuctionContextSafe } from "./useAuctionContextSafe";

export interface ResolvedAuctionIds {

    tournamentId?: string;

    auctionId?: string;

    roundId?: string;

}

export interface ResolveAuctionIdsOptions {

    tournamentId?: string;

    auctionId?: string;

    roundId?: string;

}

export function useResolvedAuctionIds(
    options: ResolveAuctionIdsOptions = {},
): ResolvedAuctionIds {

    const context = useAuctionContextSafe();

    const storeTournamentId =
        useLiveAuctionStore((s) => s.tournamentId);

    const storeAuctionId =
        useLiveAuctionStore((s) => s.auctionId);

    return {

        tournamentId:

            options.tournamentId ??

            context.tournamentId ??

            storeTournamentId,

        auctionId:

            options.auctionId ??

            context.auctionId ??

            storeAuctionId,

        roundId:

            options.roundId ??

            context.roundId,

    };

}