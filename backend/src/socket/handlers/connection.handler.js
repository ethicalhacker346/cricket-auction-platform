/**
 * connection.handler.js — General Socket.IO Connection Lifecycle
 * ----------------------------------------------------------------
 * Handles connect/disconnect logging, heartbeat ping, error handling
 */

export function handleConnection(io, socket) {
  const userLabel = socket.user
    ? `${socket.user.role || 'USER'}:${socket.userId || socket.user?._id}`
    : `ANONYMOUS:${socket.id}`;

  console.log(`[Socket] Connected: ${userLabel} | socket=${socket.id} | ip=${socket.handshake.address}`);

  // Send welcome / session info
  socket.emit('connected', {
    socketId: socket.id,
    userId: socket.userId || null,
    isAnonymous: socket.isAnonymous,
    timestamp: new Date().toISOString(),
    // Tell client which events it can listen to
    availableEvents: [
      'auction:joined',
      'auction:left',
      'auction:liveState',
      'auction:bid:placed',
      'auction:lot:opened',
      'auction:lot:sold',
      'auction:lot:unsold',
      'auction:started',
      'auction:paused',
      'auction:resumed',
      'auction:completed',
      'auction:round:added',
      'auction:round:updated',
      'auction:round:deleted',
      'auction:round:completed',
      'auction:viewer:count',
      'auction:viewer:joined',
      'auction:viewer:left',
      'auction:timer:tick',
      'auction:timer:sync',
      'auction:timer:expired',
      'auction:log',
      'auction:rules:updated',
    ],
  });

  // Generic ping/pong for latency measurement
  socket.on('ping:client', (cb) => {
    if (typeof cb === 'function') {
      cb({ serverTime: new Date().toISOString(), socketId: socket.id });
    } else {
      socket.emit('pong:server', { serverTime: new Date().toISOString() });
    }
  });

  // Client can request server time for timer sync correction
  socket.on('time:sync', (cb) => {
    const payload = { serverTime: Date.now(), iso: new Date().toISOString() };
    if (typeof cb === 'function') cb(payload);
    else socket.emit('time:sync:response', payload);
  });

  // Global error handling for this socket
  socket.on('error', (err) => {
    console.error(`[Socket] Error on ${socket.id}:`, err);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${userLabel} | reason=${reason} | socket=${socket.id}`);
    // Note: auction handler handles room cleanup via 'disconnecting' event
    // which fires BEFORE rooms are left. Here we can do final cleanup.
  });

  // For debug: list rooms this socket is in
  socket.on('rooms:list', (cb) => {
    const rooms = Array.from(socket.rooms);
    if (typeof cb === 'function') cb({ rooms });
    else socket.emit('rooms:list:response', { rooms });
  });
}

export default handleConnection;
