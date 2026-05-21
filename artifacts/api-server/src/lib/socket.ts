import { Server } from "socket.io";
  import type { Server as HttpServer } from "http";
  import { logger } from "./logger";
  import { askZeroRisco } from "./ai";
  import { db } from "@workspace/db";
  import { driverProfilesTable } from "@workspace/db";
  import { eq } from "drizzle-orm";

  let io: Server;

  const driverLocations = new Map<number, { lat: number; lng: number; categoryId: number; updatedAt: number }>();

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const dbUpdateDebounce = new Map<number, ReturnType<typeof setTimeout>>();

  async function persistDriverLocation(driverId: number, lat: number, lng: number) {
    if (dbUpdateDebounce.has(driverId)) return;
    const timer = setTimeout(() => dbUpdateDebounce.delete(driverId), 30_000);
    dbUpdateDebounce.set(driverId, timer);
    try {
      await db.update(driverProfilesTable)
        .set({ lastKnownLat: String(lat), lastKnownLng: String(lng), lastLocationAt: new Date() })
        .where(eq(driverProfilesTable.userId, driverId));
    } catch { /* não bloqueia o socket se o DB falhar */ }
  }

  export function initSocket(server: HttpServer) {
    io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
      logger.info({ socketId: socket.id }, "Novo cliente conectado via Socket.IO");

      socket.on("join_ride", (rideId: string) => {
        socket.join(`ride_${rideId}`);
      });

      socket.on("join_user", (userId: string) => {
        socket.join(`user_${userId}`);
      });

      socket.on("join_category", (data: { driverId: number; categoryId: number }) => {
        socket.join(`category_${data.categoryId}`);
      });

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
            updatedAt: Date.now(),
          });
          void persistDriverLocation(data.driverId, data.lat, data.lng);
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
        const normalizedMsg = {
          rideId: data.rideId,
          senderId: data.senderId,
          senderName: "Usuário",
          content: data.text,
          text: data.text,
          createdAt: new Date().toISOString(),
        };
        io.to(`ride_${data.rideId}`).emit("new_message", normalizedMsg);

        const lower = data.text.toLowerCase();
        if (lower.includes("ajuda") || lower.includes("ia") || lower.includes("zerorisco")) {
          try {
            const aiResponse = await askZeroRisco(data.text, `Corrida ID: ${data.rideId}`);
            io.to(`ride_${data.rideId}`).emit("new_message", {
              rideId: data.rideId,
              senderId: 0,
              senderName: "IA ZeroRisco",
              content: aiResponse,
              text: aiResponse,
              createdAt: new Date().toISOString(),
            });
          } catch { /* IA indisponível, ignora */ }
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

  export function getNearbyDriversFromMemory(lat: number, lng: number, radiusKm: number, categoryIds?: number[]) {
    const now = Date.now();
    const results: Array<{ driverId: number; lat: number; lng: number; distKm: number; categoryId: number }> = [];
    for (const [driverId, loc] of driverLocations.entries()) {
      if (now - loc.updatedAt > 5 * 60_000) continue;
      if (categoryIds && !categoryIds.includes(loc.categoryId)) continue;
      const dist = haversineKm(lat, lng, loc.lat, loc.lng);
      if (dist <= radiusKm) results.push({ driverId, lat: loc.lat, lng: loc.lng, distKm: Math.round(dist * 10) / 10, categoryId: loc.categoryId });
    }
    return results.sort((a, b) => a.distKm - b.distKm);
  }

  export function notifyDriversForRide(allowedCategoryIds: number[], rideLat: number, rideLng: number, ride: object) {
    const ioInst = getIO();
    const eligible: Array<{ driverId: number; distKm: number }> = [];
    for (const [driverId, loc] of driverLocations.entries()) {
      if (allowedCategoryIds.includes(loc.categoryId)) {
        eligible.push({ driverId, distKm: haversineKm(rideLat, rideLng, loc.lat, loc.lng) });
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
    ioInst.to(`user_${first.driverId}`).emit("new_ride_available", { ...(ride as Record<string, unknown>), priority: true });
    if (rest.length > 0) {
      setTimeout(() => {
        for (const { driverId } of rest) ioInst.to(`user_${driverId}`).emit("new_ride_available", ride);
      }, 30_000);
    }
  }

  export function emitToRide(rideId: number | string, event: string, data: unknown) {
    if (io) io.to(`ride_${rideId}`).emit(event, data);
  }

  export function emitToUser(userId: number | string, event: string, data: unknown) {
    if (io) io.to(`user_${userId}`).emit(event, data);
  }
