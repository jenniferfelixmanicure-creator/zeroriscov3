import { Server } from "socket.io";
  import type { Server as HttpServer } from "http";
  import { logger } from "./logger";
  import { askZeroRisco } from "./ai";

  let io: Server;

  // Mapa em memória: driverId → { lat, lng, categoryId }
  const driverLocations = new Map<number, { lat: number; lng: number; categoryId: number }>();

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  export function initSocket(server: HttpServer) {
    io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
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

      // Motorista entra na sala da categoria para receber novas corridas
      socket.on("join_category", (data: { driverId: number; categoryId: number }) => {
        socket.join(`category_${data.categoryId}`);
        logger.info({ socketId: socket.id, ...data }, "Motorista entrou na sala de categoria");
      });

      // FIX: localização enviada APENAS para participantes da corrida, nunca global
      socket.on("driver_location", (data: {
        driverId: number;
        rideId?: number;
        lat: number;
        lng: number;
        categoryId?: number;
      }) => {
        if (data.driverId) {
          driverLocations.set(data.driverId, {
            lat: data.lat,
            lng: data.lng,
            categoryId: data.categoryId ?? 0,
          });
        }
        if (data.rideId) {
          io.to(`ride_${data.rideId}`).emit("driver_location_update", {
            driverId: data.driverId,
            lat: data.lat,
            lng: data.lng,
          });
        }
      });

      socket.on("send_message", async (data: { rideId: number; senderId: number; text: string }) => {
        io.to(`ride_${data.rideId}`).emit("new_message", data);
        const lower = data.text.toLowerCase();
        if (lower.includes("ajuda") || lower.includes("ia") || lower.includes("zerorisco")) {
          const aiResponse = await askZeroRisco(data.text, `Corrida ID: ${data.rideId}`);
          io.to(`ride_${data.rideId}`).emit("new_message", {
            rideId: data.rideId,
            senderId: 0,
            senderName: "IA ZeroRisco",
            text: aiResponse,
            createdAt: new Date().toISOString(),
          });
        }
      });

      socket.on("driver_offline", (driverId: number) => {
        driverLocations.delete(driverId);
      });

      socket.on("disconnect", () => {
        logger.info({ socketId: socket.id }, "Cliente desconectado do Socket.IO");
      });
    });

    return io;
  }

  export function getIO(): Server {
    if (!io) throw new Error("Socket.IO não inicializado!");
    return io;
  }

  // Matching inteligente: motorista mais próximo recebe a corrida com 30s de vantagem
  export function notifyDriversForRide(
    allowedCategoryIds: number[],
    rideLat: number,
    rideLng: number,
    ride: object,
  ) {
    const ioInst = getIO();
    const eligible: Array<{ driverId: number; distKm: number }> = [];

    for (const [driverId, loc] of driverLocations.entries()) {
      if (allowedCategoryIds.includes(loc.categoryId)) {
        const dist = haversineKm(rideLat, rideLng, loc.lat, loc.lng);
        eligible.push({ driverId, distKm: dist });
      }
    }

    eligible.sort((a, b) => a.distKm - b.distKm);

    if (eligible.length === 0) {
      for (const catId of allowedCategoryIds) {
        ioInst.to(`category_${catId}`).emit("new_ride_available", ride);
      }
      return;
    }

    const [first, ...rest] = eligible;
    ioInst.to(`user_${first.driverId}`).emit("new_ride_available", { ...ride as Record<string, unknown>, priority: true });

    if (rest.length > 0) {
      setTimeout(() => {
        for (const { driverId } of rest) {
          ioInst.to(`user_${driverId}`).emit("new_ride_available", ride);
        }
      }, 30_000);
    }
  }

  export function emitToRide(rideId: number | string, event: string, data: unknown) {
    if (io) io.to(`ride_${rideId}`).emit(event, data);
  }

  export function emitToUser(userId: number | string, event: string, data: unknown) {
    if (io) io.to(`user_${userId}`).emit(event, data);
  }
  