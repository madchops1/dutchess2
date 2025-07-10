import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
console.log('[Socket] Connecting to backend at:', backendUrl);

export const socket = io(backendUrl, {
  transports: ['websocket', 'polling'],
  forceNew: true
});

socket.on('connect', () => {
  console.log('[Socket] ✅ Connected to backend:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] ❌ Disconnected from backend:', reason);
});

socket.on('connect_error', (error) => {
  console.error('[Socket] ❌ Connection error:', error);
});

socket.on('error', (error) => {
  console.error('[Socket] ❌ Socket error:', error);
});
