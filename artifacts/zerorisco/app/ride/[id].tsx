import { LinearGradient } from "expo-linear-gradient";
  import { router, useLocalSearchParams } from "expo-router";
  import React, { useEffect, useState } from "react";
  import {
    Alert,
    Animated,
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
  import { PremiumButton } from "@/components/PremiumButton";
  import { useAuth } from "@/context/AuthContext";
  import { useRide } from "@/context/RideContext";
  import { useColors } from "@/hooks/useColors";
  import { socket } from "@/lib/socket";

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
    searching: { label: "Procurando motorista...", color: "#FFB800", step: 1 },
    accepted: { label: "Motorista a caminho", color: "#00C8FF", step: 2 },
    arrived: { label: "Motorista chegou", color: "#8B5CF6", step: 3 },
    in_progress: { label: "Em andamento", color: "#00C8FF", step: 4 },
    completed: { label: "Corrida concluída", color: "#00FF9D", step: 5 },
    cancelled: { label: "Corrida cancelada", color: "#FF3A6E", step: 0 },
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

    useEffect(() => {
      fetchRide();

      socket.connect();
      socket.emit("join_ride", id);

      socket.on("ride_status_update", (payload: { rideId: number; status: string; finalFare?: number }) => {
        fetchRide();
        if (payload.status === "completed" || payload.status === "cancelled") {
          clearRide();
        }
      });

      return () => {
        socket.off("ride_status_update");
        socket.disconnect();
      };
    }, [id]);

    const fetchRide = async () => {
      try {
        const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRide(data);
          if (data.status === "completed" || data.status === "cancelled") {
            clearRide();
          }
        }
      } catch {
        // ignore
      } finally {
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
        if (res.ok) {
          const updated = await res.json();
          setRide(updated);
        }
      } catch {
        Alert.alert("Erro", "Falha ao atualizar status");
      } finally {
        setActionLoading(false);
      }
    };

    const handleCancel = async () => {
      Alert.alert("Cancelar corrida", "Deseja cancelar esta corrida?", [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar corrida",
          style: "destructive",
          onPress: () => updateStatus("cancelled"),
        },
      ]);
    };

    const openNavigation = (type: "waze" | "gmaps") => {
      if (!ride) return;
      const lat = ride.status === "accepted" ? ride.originLat : ride.destinationLat;
      const lng = ride.status === "accepted" ? ride.originLng : ride.destinationLng;

      const url =
        type === "waze"
          ? `waze://?ll=${lat},${lng}&navigate=yes`
          : `https://maps.google.com/?q=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        if (type === "waze") Linking.openURL(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`);
      });
    };

    const isDriver = user?.role === "driver";
    const config = ride ? (STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.searching) : STATUS_CONFIG.searching;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={["rgba(0,200,255,0.08)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Detalhes da corrida</Text>
          {ride && (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable
                onPress={() => Alert.alert("SOS Acionado", "As autoridades e contatos de emergência foram notificados.")}
                style={[styles.sosBtn, { backgroundColor: colors.destructive + '22' }]}
              >
                <Feather name="alert-triangle" size={20} color={colors.destructive} />
              </Pressable>
              <Pressable onPress={() => router.push(`/chat/${ride.id}`)} style={styles.chatBtn}>
                <Feather name="message-circle" size={22} color={colors.primary} />
              </Pressable>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GlowView glowColor={config.color} glowIntensity="medium" style={[styles.statusCard, { flex: 1 }]}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
              </View>
            </GlowView>

            {ride?.verificationPin && !isDriver && ["accepted", "arrived"].includes(ride.status) && (
              <GlowView glowColor={colors.primary} glowIntensity="low" style={styles.pinCard}>
                <Text style={[styles.pinLabel, { color: colors.mutedForeground }]}>PIN</Text>
                <Text style={[styles.pinValue, { color: colors.primary }]}>{ride.verificationPin}</Text>
              </GlowView>
            )}
          </View>

          {ride && (
            <GlowView style={styles.routeCard} glowIntensity="low">
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>Origem</Text>
                  <Text style={[styles.routeAddr, { color: colors.foreground }]}>{ride.originAddress}</Text>
                </View>
              </View>
              <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>Destino</Text>
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

          {ride && (
            <GlowView style={styles.driverCard} glowIntensity="low">
              <View style={styles.driverRow}>
                <LinearGradient colors={["#00C8FF", "#0044BB"]} style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {(isDriver ? ride.passengerName : ride.driverName || "M")?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: colors.foreground }]}>
                    {isDriver ? ride.passengerName : (ride.driverName || "Procurando...")}
                  </Text>
                  <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
                    {isDriver ? "Passageiro" : (ride.driverVehicle ? `${ride.driverVehicle} · ${ride.driverPlate}` : ride.categoryName)}
                  </Text>
                </View>
              </View>
            </GlowView>
          )}

          {isDriver && ride && (
            <View style={{ gap: 10, marginTop: 10 }}>
              {ride.status === "accepted" && (
                <PremiumButton title="Cheguei no local" loading={actionLoading} onPress={() => updateStatus("arrived")} />
              )}
              {ride.status === "arrived" && (
                <PremiumButton title="Iniciar corrida" loading={actionLoading} onPress={() => updateStatus("in_progress")} />
              )}
              {ride.status === "in_progress" && (
                <PremiumButton title="Finalizar corrida" loading={actionLoading} onPress={() => updateStatus("completed")} />
              )}

              {["accepted", "arrived", "in_progress"].includes(ride.status) && (
                <View style={styles.navButtons}>
                  <PremiumButton title="Waze" variant="secondary" onPress={() => openNavigation("waze")} style={{ flex: 1 }} />
                  <PremiumButton title="Maps" variant="secondary" onPress={() => openNavigation("gmaps")} style={{ flex: 1 }} />
                </View>
              )}
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
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1 },
    bgGlow: { position: "absolute", inset: 0 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
    backBtn: { padding: 4, marginRight: 12 },
    title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
    chatBtn: { padding: 4 },
    sosBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
    statusCard: { padding: 18 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusLabel: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    pinCard: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    pinLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
    pinValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
    routeCard: { padding: 16 },
    routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    routeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
    routeAddr: { fontSize: 14, fontFamily: "Inter_500Medium" },
    routeLine: { width: 1, height: 20, marginLeft: 4.5, marginVertical: 4 },
    fareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
    fareLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    fareValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
    driverCard: { padding: 16, gap: 14 },
    driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    driverAvatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
    driverName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    driverVehicle: { fontSize: 13, fontFamily: "Inter_400Regular" },
    navButtons: { flexDirection: "row", gap: 10 },
  });