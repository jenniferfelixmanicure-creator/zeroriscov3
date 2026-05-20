import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "./logger";

let io: Server;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Novo cliente conectado via Socket.IO");

    socket.on("join_ride", (rideId: string) => {
      socket.join(`ride_${rideId}`);
      logger.info({ socketId: socket.id, rideId }, "Cliente entrou na sala da corrida");
    });

    socket.on("join_user", (userId: string) => {
      socket.join(`user_${userId}`);
      logger.info({ socketId: socket.id, userId }, "Cliente entrou na sala do usuário");
    });

    socket.on("driver_location", (data: { driverId: number; lat: number; lng: number }) => {
      // Broadcast para passageiros interessados ou para o painel admin
      io.emit("driver_location_update", data);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Cliente desconectado do Socket.IO");
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO não inicializado!");
  }
  return io;
}

export function emitToRide(rideId: number | string, event: string, data: any) {
  if (io) {
    io.to(`ride_${rideId}`).emit(event, data);
  }
}

export function emitToUser(userId: number | string, event: string, data: any) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}
