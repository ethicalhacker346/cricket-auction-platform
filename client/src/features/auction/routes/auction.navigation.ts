import { AuctionRoutes } from "./auction.routes";

type RouteParams = {
    roundId?: string;
};

export function resolveAuctionRoute(
    segment: string,
    tournamentId: string,
    auctionId: string,
    params?: RouteParams
) {
    switch (segment) {

        case "dashboard":
            return AuctionRoutes.dashboard(
                tournamentId,
                auctionId,
            );

        case "configuration":
            return AuctionRoutes.configuration(
                tournamentId,
                auctionId,
            );

        case "rounds":
            return AuctionRoutes.rounds(tournamentId, auctionId);

        case "round":
            if (!params?.roundId) {
                throw new Error(
                    "resolveAuctionRoute: 'round' segment requires params.roundId"
                );
            }
            return AuctionRoutes.round(
                tournamentId,
                auctionId,
                params.roundId,
            );

        case "live":
            return AuctionRoutes.live(
                tournamentId,
                auctionId,
            );

        case "team":
            return `${AuctionRoutes.auctionRoot(
                tournamentId,
                auctionId,
            )}/team`;

        case "history":
            return AuctionRoutes.history(
                tournamentId,
                auctionId,
            );

        case "analytics":
            return AuctionRoutes.analytics(
                tournamentId,
                auctionId,
            );

        case "results":
            return AuctionRoutes.results(
                tournamentId,
                auctionId,
            );

        default:
            return AuctionRoutes.dashboard(
                tournamentId,
                auctionId,
            );
    }
}