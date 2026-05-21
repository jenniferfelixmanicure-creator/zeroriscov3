import { io, Socket } from 'socket.io-client';

const socket: Socket = io(`https://${process.env.EXPO_PUBLIC_DOMAIN}`, {
  transports: ['websocket'],
  autoConnect: false,
});

socket.on('connect', () => {
  console.log('Conectado ao Socket.IO');
});

socket.on('disconnect', () => {
  console.log('Desconectado do Socket.IO');
});

socket.on('connect_error', (err) => {
  console.warn('Erro de conexão Socket.IO:', err.message);
});

export { socket };

export const initSocket = (token?: string) => {
  if (!socket.connected) {
    if (token) {
      socket.auth = { token };
    }
    socket.connect();
  }
  return socket;
};

export const getSocket = () => socket;

export const joinRideRoom = (rideId: number) => {
  socket.emit('join_ride', String(rideId));
};

export const joinUserRoom = (userId: number) => {
  socket.emit('join_user', String(userId));
};

export const disconnectSocket = () => {
  socket.disconnect();
};
