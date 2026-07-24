import { AuctionService } from '../services/auction.service.js';
import { BidService } from '../services/bid.service.js';
import { AuctionAuthorizationService } from '../services/auction-authorization.service.js';

export const auctionController = {
  create: async (req, res) => {

    console.log("Controller req.body", req.body);
    const auction = await AuctionService.create(req.params.tournamentId, req.user, req.body);
    console.log(req.body);
    return res.status(201).json({ success: true, data: auction });
  },

  getByTournament: async (req, res) => {
    const auction =
      await AuctionService.findByTournament(
        req.params.tournamentId
      );

    return res.status(200).json({
      success: true,
      data: auction, // Auction OR null
    });
  },

  getById: async (req, res) => {
    // CHANGE: getByIdPopulated (not getById) — the service's getById() was
    // slimmed down to stop populating tournamentId for internal callers
    // (assertOrganizer, openLot, start, etc.). This route is the public
    // GET /auctions/:auctionId and previously returned a populated
    // tournament object, so it needs the populated variant explicitly to
    // avoid silently changing the API response shape for existing clients.
    const auction = await AuctionService.getByIdPopulated(req.params.auctionId);
    return res.json({ success: true, data: auction });
  },

  updateRules: async (req, res) => {
    const auction = await AuctionService.updateRules(req.params.auctionId, req.user, req.body, req.authorization);
    return res.json({ success: true, data: auction });
  },

  addRound: async (req, res) => {
    const round = await AuctionService.addRound(req.params.auctionId, req.user, req.body, req.authorization);
    return res.status(201).json({ success: true, data: round });
  },

  listRounds: async (req, res) => {
    const rounds = await AuctionService.listRounds(req.params.auctionId);
    return res.json({ success: true, data: rounds });
  },

  updateRound: async (req, res) => {
    const round = await AuctionService.updateRound(req.params.auctionId, req.params.roundId, req.user, req.body, req.authorization);
    return res.json({ success: true, data: round });
  },

  deleteRound: async (req, res) => {
    const result = await AuctionService.deleteRound(req.params.auctionId, req.params.roundId, req.user, req.authorization);
    return res.json({ success: true, data: result });
  },

  start: async (req, res) => {
    const auction = await AuctionService.start(req.params.auctionId, req.user, req.authorization);
    return res.json({ success: true, data: auction });
  },

  pause: async (req, res) => {
    const auction = await AuctionService.pause(req.params.auctionId, req.user, req.authorization);
    return res.json({ success: true, data: auction });
  },

  resume: async (req, res) => {
    const auction = await AuctionService.resume(req.params.auctionId, req.user, req.authorization);
    return res.json({ success: true, data: auction });
  },

  openLot: async (req, res) => {
    const auction = await AuctionService.openLot(req.params.auctionId, req.user, req.body, req.authorization);
    return res.json({ success: true, data: auction });
  },

  settleLotSold: async (req, res) => {
    const auction = await BidService.settleLot(req.params.auctionId, req.user, true, req.authorization);
    return res.json({ success: true, data: auction });
  },

  settleLotUnsold: async (req, res) => {
    const auction = await BidService.settleLot(req.params.auctionId, req.user, false, req.authorization);
    return res.json({ success: true, data: auction });
  },

  getPermissions: async (req, res) => {
    const context = req.authorization || await AuctionAuthorizationService.buildContext({
      auctionId: req.params.auctionId,
      user: req.user,
    });
    const data = AuctionAuthorizationService.toPublicPermissions(context);
    const aliases = {
      canManageAuction: data.permissions.MANAGE_AUCTION,
      canStart: data.permissions.START_AUCTION,
      canPause: data.permissions.PAUSE_AUCTION,
      canResume: data.permissions.RESUME_AUCTION,
      canOpenLot: data.permissions.OPEN_LOT,
      canForceSold: data.permissions.SETTLE_LOT,
      canBid: data.permissions.PLACE_BID,
    };
    return res.json({ success: true, data: { ...aliases, ...data } });
  },

  getLiveState: async (req, res) => {
    const state = await AuctionService.getLiveState(req.params.auctionId);
    return res.json({ success: true, data: state });
  },

  // Live viewer presence. No organizer check — any authenticated or
  // anonymous spectator on the live screen is meant to be counted here;
  // see AuctionService.heartbeatViewer for the reasoning.
  heartbeatViewer: async (req, res) => {
    const viewerCount = await AuctionService.heartbeatViewer(
      req.params.auctionId,
      req.body.viewerId,
      req.user?._id ?? null
    );
    return res.json({ success: true, data: { viewerCount } });
  },

  // Fired from the client's beforeunload/sendBeacon handler so the count
  // drops immediately on a clean tab close instead of waiting for the
  // heartbeat TTL to expire the presence row.
  leaveViewer: async (req, res) => {
    const viewerCount = await AuctionService.removeViewer(req.params.auctionId, req.body.viewerId);
    return res.json({ success: true, data: { viewerCount } });
  },

  getViewerCount: async (req, res) => {
    const viewerCount = await AuctionService.getViewerCount(req.params.auctionId);
    return res.json({ success: true, data: { viewerCount } });
  },

  getSnapshot: async (req, res) => {
    const snapshot = await AuctionService.getSnapshot(req.params.auctionId);
    return res.json({ success: true, data: snapshot });
  },

  complete: async (req, res) => {
    const auction = await AuctionService.complete(req.params.auctionId, req.user, req.authorization);
    return res.json({ success: true, data: auction });
  },

  placeBid: async (req, res) => {
    const bid = await BidService.placeBid(req.params.auctionId, req.user, req.body, req.authorization);
    return res.status(201).json({ success: true, data: bid });
  },

  listBids: async (req, res) => {
    const bids = await BidService.listBids(req.params.auctionId, req.query);
    return res.json({ success: true, data: bids });
  },
};