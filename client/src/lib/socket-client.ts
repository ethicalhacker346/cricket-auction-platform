import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;

let socket: Socket | null = null;
let reconnectAttempts = 0;

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  transport: string;
}

let stateListeners: ((state: SocketState) => void)[] = [];

function notifyState(state: SocketState) {
  stateListeners.forEach((listener) => listener(state));
}

export function subscribeToSocketState(listener: (state: SocketState) => void) {
  stateListeners.push(listener);
  return () => {
    stateListeners = stateListeners.filter((l) => l !== listener);
  };
}

function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function createSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = getAuthToken();

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: {
      token: token || undefined,
    },
    reconnection: true,
    reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 45000,
    forceNew: false,
    autoConnect: true,
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
    notifyState({
      connected: true,
      connecting: false,
      error: null,
      transport: socket?.io.engine?.transport?.name || 'unknown',
    });
    console.info('[Socket] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    notifyState({
      connected: false,
      connecting: true,
      error: err.message,
      transport: 'unknown',
    });
    
    if (err.message === 'Authentication error') {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
  });

  socket.on('disconnect', (reason) => {
    notifyState({
      connected: false,
      connecting: reason === 'io server disconnect',
      error: null,
      transport: 'unknown',
    });
    console.warn('[Socket] Disconnected:', reason);

    if (reason === 'io server disconnect') {
      setTimeout(() => socket?.connect(), 1000);
    }
  });

  socket.on('system:maintenance', (data: { message: string; reconnectAfter: number }) => {
    console.warn('[Socket] Maintenance:', data.message);
    setTimeout(() => {
      socket?.disconnect();
      socket?.connect();
    }, data.reconnectAfter);
  });

  socket.io.engine?.on('upgrade', (transport) => {
    console.info('[Socket] Transport upgraded to:', transport.name);
    notifyState({
      connected: socket?.connected || false,
      connecting: false,
      error: null,
      transport: transport.name,
    });
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinAuctionRoom(auctionId: string): void {
  if (!socket?.connected) {
    console.warn('[Socket] Cannot join room — not connected');
    return;
  }
  socket.emit('auction:join', { auctionId });
}

export function leaveAuctionRoom(auctionId: string): void {
  socket?.emit('auction:leave', { auctionId });
}

export function placeBid(auctionId: string, playerId: string, amount: number): void {
  if (!socket?.connected) {
    throw new Error('Socket not connected');
  }
  socket.emit('auction:bid', { auctionId, playerId, amount });
}