import { useParams } from "react-router-dom";

export interface AuctionContextSafe {

    tournamentId?: string;

    auctionId?: string;

    roundId?: string;

}

export function useAuctionContextSafe(): AuctionContextSafe {

    const {

        tournamentId,

        auctionId,

        roundId,

    } = useParams();

    return {

        tournamentId,

        auctionId,

        roundId,

    };

}