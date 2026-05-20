import { io, Socket } from 'socket.io-client';

let socket: Socket;

export const initSocket = (token: string) => {
  if (!socket) {
    socket = io(`https://${process.env.EXPO_PUBLIC_DOMAIN}`, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Conectado ao Socket.IO');
    });

    socket.on('disconnect', () => {
      console.log('Desconectado do Socket.IO');
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    console.warn('Socket não inicializado!');
  }
  return socket;
};

export const joinRideRoom = (rideId: number) => {
  if (socket) {
    socket.emit('join_ride', String(rideId));
  }
};

export const joinUserRoom = (userId: number) => {
  if (socket) {
    socket.emit('join_user', String(userId));
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    (socket as any) = null;
  }
};
