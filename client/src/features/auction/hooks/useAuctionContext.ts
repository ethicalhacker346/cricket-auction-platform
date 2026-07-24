import { useParams } from "react-router-dom";

export interface AuctionContext {

    tournamentId: string;

    auctionId: string;

    roundId?: string;

}

export function useAuctionContext(): AuctionContext {

    const {

        tournamentId,

        auctionId,

        roundId,

    } = useParams();

    if (!tournamentId)
        throw new Error("Missing tournamentId");

    if (!auctionId)
        throw new Error("Missing auctionId");

    return {

        tournamentId,

        auctionId,

        roundId,

    };

}