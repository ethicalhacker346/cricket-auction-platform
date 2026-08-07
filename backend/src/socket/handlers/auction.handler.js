/**
 * auction.handler.js — Auction Room Management + Viewer Presence via WebSockets
 * -------------------------------------------------------------------------------
 * Responsibilities:
 *  - auction:join  -> join room auction:{auctionId}, track viewer, broadcast count
 *  - auction:leave -> leave room, broadcast
 *  - auction:heartbeat -> keep-alive for viewer count (socket alternative to REST heartbeat)
 *  - disconnecting -> cleanup viewer presence
 *
 * Does NOT handle bid placement (bid remains REST for transactional safety).
 * Only publishes realtime state changes originating from REST services.
 *
 * Room naming: `auction:${auctionId}`
 * Personal user rooms: `user:${userId}` (created in auth middleware)
 */

import mongoose from "mongoose";
import eventBus from "../../events/eventBus.js";
import {
  emitViewerJoined,
  emitViewerLeft,
  emitViewerCountUpdated,
} from "../../events/auction.events.js";

import { toTransportDTO } from "../../utils/transport-serializer.js"; // ← NEW

// In-memory tracker for socket viewers — complements DB-based AuctionViewer
// Map<auctionId, Map<viewerId, { socketIds, userId, lastSeen }>>
const auctionViewers = new Map();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getRoomName(auctionId) {
  return `auction:${auctionId}`;
}

function getAuctionViewerMap(auctionId) {
  if (!auctionViewers.has(auctionId)) auctionViewers.set(auctionId, new Map());
  return auctionViewers.get(auctionId);
}

function getViewerCount(auctionId) {
  const map = auctionViewers.get(auctionId);
  return map ? map.size : 0;
}

// Try to import AuctionService for DB-backed viewer tracking if available
let AuctionService = null;
try {
  const mod = await import("../../services/auction.service.js").catch(
    () => null,
  );
  if (mod?.AuctionService) AuctionService = mod.AuctionService;
} catch (_) {}

export function handleAuctionEvents(io, socket) {
  // ---------- JOIN ----------
  socket.on("auction:join", async (payload, ack) => {
    try {
      const { auctionId, viewerId } = payload || {};
      if (!auctionId) {
        const err = { success: false, message: "auctionId is required" };
        if (typeof ack === "function") return ack(err);
        return socket.emit("auction:error", err);
      }
      if (!isValidObjectId(auctionId)) {
        const err = { success: false, message: "Invalid auctionId format" };
        if (typeof ack === "function") return ack(err);
        return socket.emit("auction:error", err);
      }

      const room = getRoomName(auctionId);
      const finalViewerId = viewerId || socket.userId || socket.id;

      // Join socket.io room
      await socket.join(room);

      // Track in-memory
      const viewers = getAuctionViewerMap(auctionId);
      if (!viewers.has(finalViewerId)) {
        viewers.set(finalViewerId, {
          socketIds: new Set([socket.id]),
          userId: socket.userId || null,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      } else {
        const entry = viewers.get(finalViewerId);
        entry.socketIds.add(socket.id);
        entry.lastSeen = new Date();
      }

      // Store on socket for disconnect cleanup
      if (!socket.data.auctions) socket.data.auctions = new Set();
      socket.data.auctions.add(auctionId);
      if (!socket.data.viewerIds) socket.data.viewerIds = new Map();
      socket.data.viewerIds.set(auctionId, finalViewerId);

      const viewerCount = getViewerCount(auctionId);

      // Try DB persistence if service exists (so REST getViewerCount stays consistent)
      if (AuctionService?.heartbeatViewer) {
        try {
          await AuctionService.heartbeatViewer(
            auctionId,
            finalViewerId,
            socket.userId || null,
          );
        } catch (e) {
          console.warn("[AuctionHandler] heartbeatViewer DB failed", e.message);
        }
      }

      // Emit domain events so publisher broadcasts
      emitViewerJoined(auctionId, {
        viewerId: finalViewerId,
        userId: socket.userId || null,
        viewerCount,
      });
      emitViewerCountUpdated(auctionId, viewerCount, {
        source: "socket:join",
        viewerId: finalViewerId,
      });

      console.log(
        `[AuctionHandler] ${finalViewerId} joined ${room} (socket ${socket.id}) count=${viewerCount}`,
      );

      const response = {
        success: true,
        data: {
          auctionId,
          room,
          viewerId: finalViewerId,
          viewerCount,
          socketId: socket.id,
        },
      };

      // Ack to joining client with liveState if we can fetch it
      if (AuctionService?.getLiveState) {
        try {
          const liveState = await AuctionService.getLiveState(auctionId);
          response.data.liveState = liveState;
        } catch (_) {
          // ignore, maybe auction not found — still joined room
        }
      }

      if (typeof ack === "function") return ack(response);
      socket.emit("auction:joined", response.data);

      // Notify others in room excluding sender about new viewer
      socket.to(room).emit("auction:viewer:joined", {
        auctionId,
        viewerId: finalViewerId,
        userId: socket.userId || null,
        viewerCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[AuctionHandler] join error", err);
      const errorPayload = { success: false, message: err.message };
      if (typeof ack === "function") ack(errorPayload);
      else socket.emit("auction:error", errorPayload);
    }
  });

  // Alias for join
  socket.on("auction:subscribe", (...args) => {
    // delegate
    socket.listeners("auction:join")[0]?.(...args);
  });

  // ---------- LEAVE ----------
  socket.on("auction:leave", async (payload, ack) => {
    try {
      const { auctionId } = payload || {};
      if (!auctionId) {
        const err = { success: false, message: "auctionId required" };
        if (typeof ack === "function") return ack(err);
        return socket.emit("auction:error", err);
      }
      const room = getRoomName(auctionId);
      await socket.leave(room);

      const finalViewerId =
        socket.data.viewerIds?.get(auctionId) || socket.userId || socket.id;
      const viewers = auctionViewers.get(auctionId);
      if (viewers) {
        const entry = viewers.get(finalViewerId);
        if (entry) {
          entry.socketIds.delete(socket.id);
          if (entry.socketIds.size === 0) {
            viewers.delete(finalViewerId);
          }
        }
        if (viewers.size === 0) auctionViewers.delete(auctionId);
      }

      socket.data.auctions?.delete(auctionId);
      socket.data.viewerIds?.delete(auctionId);

      const viewerCount = getViewerCount(auctionId);

      if (AuctionService?.removeViewer) {
        try {
          await AuctionService.removeViewer(auctionId, finalViewerId);
        } catch (_) {}
      }

      emitViewerLeft(auctionId, { viewerId: finalViewerId, viewerCount });
      emitViewerCountUpdated(auctionId, viewerCount, {
        source: "socket:leave",
      });

      console.log(
        `[AuctionHandler] ${finalViewerId} left ${room} count=${viewerCount}`,
      );

      const resp = { success: true, data: { auctionId, viewerCount } };
      if (typeof ack === "function") return ack(resp);
      socket.emit("auction:left", resp.data);
      socket.to(room).emit("auction:viewer:left", {
        auctionId,
        viewerId: finalViewerId,
        viewerCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[AuctionHandler] leave error", err);
      if (typeof ack === "function")
        ack({ success: false, message: err.message });
    }
  });

  // ---------- HEARTBEAT (viewer presence keep-alive) ----------
  socket.on("auction:heartbeat", async (payload, ack) => {
    try {
      const { auctionId, viewerId } = payload || {};
      if (!auctionId) {
        if (typeof ack === "function")
          return ack({ success: false, message: "auctionId required" });
        return;
      }
      const finalViewerId =
        viewerId || socket.data.viewerIds?.get(auctionId) || socket.id;
      const viewers = getAuctionViewerMap(auctionId);
      if (viewers.has(finalViewerId)) {
        viewers.get(finalViewerId).lastSeen = new Date();
      }
      if (AuctionService?.heartbeatViewer) {
        try {
          await AuctionService.heartbeatViewer(
            auctionId,
            finalViewerId,
            socket.userId || null,
          );
        } catch (_) {}
      }
      const viewerCount = getViewerCount(auctionId);
      if (typeof ack === "function")
        ack({
          success: true,
          data: { viewerCount, serverTime: new Date().toISOString() },
        });
    } catch (err) {
      if (typeof ack === "function")
        ack({ success: false, message: err.message });
    }
  });

  // ---------- GET LIVE STATE via socket ----------
  socket.on("auction:getLiveState", async (payload, ack) => {
    try {
      const { auctionId } = payload || {};
      if (!auctionId) {
        if (typeof ack === "function")
          return ack({ success: false, message: "auctionId required" });
        return;
      }
      if (!AuctionService?.getLiveState) {
        if (typeof ack === "function")
          return ack({
            success: false,
            message: "LiveState service not available",
          });
        return;
      }
      const state = await AuctionService.getLiveState(auctionId);
      const safeState = toTransportDTO(state); // ← NEW

      if (typeof ack === "function")
        return ack({ success: true, data: safeState });
      socket.emit("auction:liveState", safeState);
    } catch (err) {
      if (typeof ack === "function")
        ack({ success: false, message: err.message });
    }
  });

  // ---------- GET SNAPSHOT via socket ----------
  socket.on("auction:getSnapshot", async (payload, ack) => {
    try {
      const { auctionId } = payload || {};
      if (!AuctionService?.getSnapshot) {
        if (typeof ack === "function")
          return ack({ success: false, message: "Snapshot not available" });
        return;
      }
      const snap = await AuctionService.getSnapshot(auctionId);
      const safeSnap = toTransportDTO(snap); // ← NEW

      if (typeof ack === "function")
        return ack({ success: true, data: safeSnap });
      socket.emit("auction:snapshot", safeSnap);
    } catch (err) {
      if (typeof ack === "function")
        ack({ success: false, message: err.message });
    }
  });

  // ---------- DISCONNECTING cleanup ----------
  socket.on("disconnecting", async () => {
    try {
      // io rooms still contain joined rooms at this point
      const rooms = Array.from(socket.rooms); // includes own socket.id room
      const auctionRooms = rooms.filter((r) => r.startsWith("auction:"));
      for (const room of auctionRooms) {
        const auctionId = room.replace("auction:", "");
        const finalViewerId =
          socket.data.viewerIds?.get(auctionId) || socket.userId || socket.id;
        const viewers = auctionViewers.get(auctionId);
        if (viewers) {
          const entry = viewers.get(finalViewerId);
          if (entry) {
            entry.socketIds.delete(socket.id);
            if (entry.socketIds.size === 0) viewers.delete(finalViewerId);
          }
          if (viewers.size === 0) auctionViewers.delete(auctionId);
        }
        const viewerCount = getViewerCount(auctionId);
        // Don't await DB heavily on disconnecting — best effort
        if (AuctionService?.removeViewer) {
          AuctionService.removeViewer(auctionId, finalViewerId).catch(() => {});
        }
        emitViewerLeft(auctionId, { viewerId: finalViewerId, viewerCount });
        emitViewerCountUpdated(auctionId, viewerCount, {
          source: "disconnecting",
        });
      }
    } catch (err) {
      console.error("[AuctionHandler] disconnecting cleanup error", err);
    }
  });
}

// Debug helper to inspect current in-memory viewers
export function _getAuctionViewersDebug() {
  const out = {};
  for (const [auctionId, map] of auctionViewers.entries()) {
    out[auctionId] = Array.from(map.entries()).map(([viewerId, v]) => ({
      viewerId,
      socketCount: v.socketIds.size,
      userId: v.userId,
      lastSeen: v.lastSeen,
    }));
  }
  return out;
}

export default handleAuctionEvents;
