import { AuctionService } from '../services/auction.service.js';
import { BidService } from '../services/bid.service.js';

export const auctionController = {
  create: async (req, res) => {
    const auction = await AuctionService.create(req.params.tournamentId, req.user, req.body);
    return res.status(201).json({ success: true, data: auction });
  },

  getByTournament: async (req, res) => {
    const auction = await AuctionService.getByTournament(req.params.tournamentId);
    return res.json({ success: true, data: auction });
  },

  getById: async (req, res) => {
    const auction = await AuctionService.getById(req.params.auctionId);
    return res.json({ success: true, data: auction });
  },

  addRound: async (req, res) => {
    const round = await AuctionService.addRound(req.params.auctionId, req.user, req.body);
    return res.status(201).json({ success: true, data: round });
  },

  start: async (req, res) => {
    const auction = await AuctionService.start(req.params.auctionId, req.user);
    return res.json({ success: true, data: auction });
  },

  pause: async (req, res) => {
    const auction = await AuctionService.pause(req.params.auctionId, req.user);
    return res.json({ success: true, data: auction });
  },

  resume: async (req, res) => {
    const auction = await AuctionService.resume(req.params.auctionId, req.user);
    return res.json({ success: true, data: auction });
  },

  openLot: async (req, res) => {
    const auction = await AuctionService.openLot(req.params.auctionId, req.user, req.body);
    return res.json({ success: true, data: auction });
  },

  settleLotSold: async (req, res) => {
    const auction = await BidService.settleLot(req.params.auctionId, req.user, true);
    return res.json({ success: true, data: auction });
  },

  settleLotUnsold: async (req, res) => {
    const auction = await BidService.settleLot(req.params.auctionId, req.user, false);
    return res.json({ success: true, data: auction });
  },

  getLiveState: async (req, res) => {
    const state = await AuctionService.getLiveState(req.params.auctionId);
    return res.json({ success: true, data: state });
  },

  complete: async (req, res) => {
    const auction = await AuctionService.complete(req.params.auctionId, req.user);
    return res.json({ success: true, data: auction });
  },

  placeBid: async (req, res) => {
    const bid = await BidService.placeBid(req.params.auctionId, req.user, req.body);
    return res.status(201).json({ success: true, data: bid });
  },

  listBids: async (req, res) => {
    const bids = await BidService.listBids(req.params.auctionId, req.query);
    return res.json({ success: true, data: bids });
  },
};
