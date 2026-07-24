export const AuctionRoutes = {

    tournament(tournamentId: string) {
        return `/tournaments/${tournamentId}`;
    },

    createAuction(tournamentId: string) {
        return `/tournaments/${tournamentId}/auction/create`;
    },

    auctionRoot(
        tournamentId: string,
        auctionId: string,
    ) {
        return `/tournaments/${tournamentId}/auction/${auctionId}`;
    },

    dashboard(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/dashboard`;
    },

    configuration(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/configuration`;
    },

    rounds(tournamentId: string, auctionId: string) {
      return `${this.auctionRoot(tournamentId, auctionId)}/rounds`;
    },

    round(tournamentId: string, auctionId: string, roundId: string) {
      return `${this.rounds(tournamentId, auctionId)}/${roundId}`;
    },

    live(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/live`;
    },

    history(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/history`;
    },

    analytics(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/analytics`;
    },

    results(
        tournamentId: string,
        auctionId: string,
    ) {
        return `${this.auctionRoot(
            tournamentId,
            auctionId,
        )}/results`;
    }

} as const;

export const AuctionRouteParams = {

    tournamentId: "tournamentId",

    auctionId: "auctionId",

    roundId: "roundId",

} as const;

export const AuctionSegments = {

    dashboard: "dashboard",

    configuration: "configuration",

    rounds: "rounds",

    round: "round",

    live: "live",

    history: "history",

    analytics: "analytics",

    results: "results",

} as const;