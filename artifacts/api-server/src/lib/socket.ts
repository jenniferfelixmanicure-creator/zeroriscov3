import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "./logger";
import { askZeroRisco } from "./ai";

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

    socket.on("send_message", async (data: { rideId: number; senderId: number; text: string }) => {
      // 1. Retransmitir a mensagem para todos na sala da corrida
      io.to(`ride_${data.rideId}`).emit("new_message", data);

      // 2. Se a mensagem for direcionada à IA ou o suporte for necessário
      if (data.text.toLowerCase().includes("ajuda") || data.text.toLowerCase().includes("ia") || data.text.toLowerCase().includes("zerorisco")) {
        const aiResponse = await askZeroRisco(data.text, `Corrida ID: ${data.rideId}, Remetente ID: ${data.senderId}`);
        
        const aiMsg = {
          rideId: data.rideId,
          senderId: 0, // 0 representa a IA ZeroRisco
          senderName: "IA ZeroRisco",
          text: aiResponse,
          createdAt: new Date().toISOString()
        };

        io.to(`ride_${data.rideId}`).emit("new_message", aiMsg);
      }
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
