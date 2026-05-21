import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GlowView } from "@/components/GlowView";
import ProfessionalMap from "@/components/ProfessionalMap";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useRide } from "@/context/RideContext";
import { useColors } from "@/hooks/useColors";
import { getRoute } from "@/lib/routing";
import { socket } from "@/lib/socket";

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RideDetail {
  id: number;
  status: string;
  categoryName: string;
  originAddress: string;
  destinationAddress: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  estimatedFare: number;
  finalFare?: number | null;
  passengerId: number;
  passengerName?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverRating?: number | null;
  driverVehicle?: string | null;
  driverPlate?: string | null;
  estimatedDistance: number;
  estimatedDuration: number;
  verificationPin?: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  searching:   { label: "Procurando motorista...", color: "#FFB800", step: 1 },
  accepted:    { label: "Motorista a caminho",     color: "#00C8FF", step: 2 },
  arrived:     { label: "Motorista chegou",        color: "#8B5CF6", step: 3 },
  in_progress: { label: "Em andamento",            color: "#00C8FF", step: 4 },
  completed:   { label: "Corrida concluída",       color: "#00FF9D", step: 5 },
  cancelled:   { label: "Corrida cancelada",       color: "#FF3A6E", step: 0 },
};

export default function RideDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { clearRide } = useRide();

  const [ride, setRide] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);

  const isDriver = user?.role === "driver";
  const config = ride ? (STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.searching) : STATUS_CONFIG.searching;

  const origin: Coordinate | undefined = ride
    ? { latitude: ride.originLat, longitude: ride.originLng }
    : undefined;
  const destination: Coordinate | undefined = ride
    ? { latitude: ride.destinationLat, longitude: ride.destinationLng }
    : undefined;

  // Socket: join ride room + listen to real-time events
  useEffect(() => {
    fetchRide();
    socket.connect();
    socket.emit("join_ride", id);

    socket.on("ride_status_update", (payload: { rideId: number; status: string; finalFare?: number }) => {
      fetchRide();
      if (payload.status === "completed" || payload.status === "cancelled") clearRide();
    });

    socket.on("driver_location_update", (payload: { driverId: number; lat: number; lng: number }) => {
      setDriverLocation({ latitude: payload.lat, longitude: payload.lng });
    });

    return () => {
      socket.off("ride_status_update");
      socket.off("driver_location_update");
      socket.disconnect();
    };
  }, [id]);

  // Own GPS → pulsing blue dot (both roles)
  useEffect(() => {
    if (Platform.OS === "web") {
      if (!navigator.geolocation) return;
      const wid = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(wid);
    } else {
      let sub: Location.LocationSubscription | null = null;
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status !== "granted") return;
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (loc) => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
        ).then((s) => { sub = s; });
      });
      return () => { if (sub) sub.remove(); };
    }
  }, []);

  // Driver: broadcast GPS to socket during active ride
  useEffect(() => {
    if (!isDriver || !ride || !user?.id) return;
    const active = ["accepted", "arrived", "in_progress"];
    if (!active.includes(ride.status)) return;

    const emit = (lat: number, lng: number) => {
      socket.emit("driver_location", { driverId: user.id, rideId: ride.id, lat, lng });
    };

    if (Platform.OS === "web") {
      if (!navigator.geolocation) return;
      const wid = navigator.geolocation.watchPosition(
        (pos) => {
          const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(coord);
          emit(coord.latitude, coord.longitude);
        },
        null,
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
      return () => navigator.geolocation.clearWatch(wid);
    } else {
      let sub: Location.LocationSubscription | null = null;
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status !== "granted") return;
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 8 },
          (loc) => {
            const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coord);
            emit(coord.latitude, coord.longitude);
          }
        ).then((s) => { sub = s; });
      });
      return () => { if (sub) sub.remove(); };
    }
  }, [isDriver, ride?.id, ride?.status, user?.id]);

  // Draw route when origin + destination are known
  useEffect(() => {
    if (!origin || !destination) return;
    getRoute(origin, destination).then((r) => {
      if (r) setRouteCoords(r.coordinates);
    });
  }, [ride?.originLat, ride?.destinationLat]);

  const fetchRide = async () => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRide(data);
        if (data.status === "completed" || data.status === "cancelled") clearRide();
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setRide(await res.json());
    } catch {
      Alert.alert("Erro", "Falha ao atualizar status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancelar corrida", "Deseja cancelar esta corrida?", [
      { text: "Não", style: "cancel" },
      { text: "Cancelar corrida", style: "destructive", onPress: () => updateStatus("cancelled") },
    ]);
  };

  const openNavigation = (type: "waze" | "gmaps") => {
    if (!ride) return;
    const lat = ride.status === "accepted" ? ride.originLat : ride.destinationLat;
    const lng = ride.status === "accepted" ? ride.originLng : ride.destinationLng;
    const url = type === "waze"
      ? `waze://?ll=${lat},${lng}&navigate=yes`
      : `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      if (type === "waze") Linking.openURL(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`);
    });
  };

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ── */}
      <ProfessionalMap
        origin={origin}
        destination={destination}
        driverLocation={driverLocation ?? undefined}
        userLocation={userLocation ?? undefined}
        routeCoordinates={routeCoords}
      />

      {/* Top gradient so header is readable */}
      <LinearGradient
        colors={["rgba(6,13,26,0.85)", "rgba(6,13,26,0.4)", "transparent"]}
        style={[styles.topGradient, { height: insets.top + 80 }]}
        pointerEvents="none"
      />

      {/* ── Floating header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.statusDot, { backgroundColor: config.color }]} />
          <Text style={styles.headerStatus}>{config.label}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => Alert.alert("SOS Acionado", "Autoridades e contatos de emergência notificados.")}
            style={[styles.iconBtn, { backgroundColor: "rgba(255,58,110,0.2)" }]}
          >
            <Feather name="alert-triangle" size={18} color="#FF3A6E" />
          </Pressable>
          {ride && (
            <Pressable onPress={() => router.push(`/chat/${ride.id}`)} style={styles.iconBtn}>
              <Feather name="message-circle" size={22} color="#00C8FF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHandle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* PIN */}
          {ride?.verificationPin && !isDriver && ["accepted", "arrived"].includes(ride.status) && (
            <GlowView glowColor={colors.primary} glowIntensity="low" style={styles.pinRow}>
              <Text style={styles.pinLabel}>PIN DE VERIFICAÇÃO</Text>
              <Text style={[styles.pinValue, { color: colors.primary }]}>{ride.verificationPin}</Text>
            </GlowView>
          )}

          {/* Route info */}
          {ride && (
            <GlowView style={styles.card} glowIntensity="low">
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>Origem</Text>
                  <Text style={[styles.routeAddr, { color: colors.foreground }]}>{ride.originAddress}</Text>
                </View>
              </View>
              <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>Destino</Text>
                  <Text style={[styles.routeAddr, { color: colors.foreground }]}>{ride.destinationAddress}</Text>
                </View>
              </View>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>
                  {ride.estimatedDistance.toFixed(1)} km · {ride.estimatedDuration} min
                </Text>
                <Text style={[styles.fareValue, { color: colors.primary }]}>
                  R$ {(ride.finalFare ?? ride.estimatedFare).toFixed(2).replace(".", ",")}
                </Text>
              </View>
            </GlowView>
          )}

          {/* Driver / passenger info */}
          {ride && (
            <GlowView style={styles.card} glowIntensity="low">
              <View style={styles.personRow}>
                <LinearGradient colors={["#00C8FF", "#0044BB"]} style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(isDriver ? ride.passengerName : ride.driverName || "M")
                      ?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personName, { color: colors.foreground }]}>
                    {isDriver ? ride.passengerName : (ride.driverName || "Procurando motorista...")}
                  </Text>
                  <Text style={[styles.personSub, { color: colors.mutedForeground }]}>
                    {isDriver
                      ? "Passageiro"
                      : ride.driverVehicle
                        ? `${ride.driverVehicle} · ${ride.driverPlate}`
                        : ride.categoryName}
                  </Text>
                </View>
                {ride.driverRating && !isDriver && (
                  <View style={styles.ratingBadge}>
                    <Feather name="star" size={12} color="#FFB800" />
                    <Text style={styles.ratingText}>{ride.driverRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </GlowView>
          )}

          {/* Driver actions */}
          {isDriver && ride && ["accepted", "arrived", "in_progress"].includes(ride.status) && (
            <View style={styles.actionsCol}>
              {ride.status === "accepted" && (
                <PremiumButton title="Cheguei no local" loading={actionLoading} onPress={() => updateStatus("arrived")} />
              )}
              {ride.status === "arrived" && (
                <PremiumButton title="Iniciar corrida" loading={actionLoading} onPress={() => updateStatus("in_progress")} />
              )}
              {ride.status === "in_progress" && (
                <PremiumButton title="Finalizar corrida" loading={actionLoading} onPress={() => updateStatus("completed")} />
              )}
              <View style={styles.navRow}>
                <PremiumButton title="Waze" variant="secondary" onPress={() => openNavigation("waze")} style={{ flex: 1 }} />
                <PremiumButton title="Maps" variant="secondary" onPress={() => openNavigation("gmaps")} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {!isDriver && ride?.status === "searching" && (
            <PremiumButton title="Cancelar corrida" variant="danger" onPress={handleCancel} />
          )}

          {ride?.status === "completed" && (
            <PremiumButton
              title="Voltar ao início"
              variant="ghost"
              onPress={() => router.replace(isDriver ? "/(driver)" : "/(passenger)")}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060D1A" },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(6,13,26,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, backgroundColor: "rgba(6,13,26,0.7)",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  headerStatus: { color: "#E4F0FF", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0A1628",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderTopColor: "#1A3050",
    maxHeight: "55%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#1A3050", alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 10 },
  pinRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 12,
  },
  pinLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, color: "#4E7090" },
  pinValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  card: { padding: 14, borderRadius: 14 },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#4E7090", marginBottom: 2 },
  routeAddr: { fontSize: 13, fontFamily: "Inter_500Medium" },
  routeLine: { width: 1, height: 16, marginLeft: 4.5, marginVertical: 4 },
  fareRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1A3050",
  },
  fareLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fareValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  personName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  personSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFB80022", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: "#FFB800", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionsCol: { gap: 10 },
  navRow: { flexDirection: "row", gap: 10 },
});
