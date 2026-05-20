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
  driverName?: string | null;
  driverPhone?: string | null;
  driverRating?: number | null;
  driverVehicle?: string | null;
  driverPlate?: string | null;
  estimatedDistance: number;
  estimatedDuration: number;
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
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    fetchRide();
    const interval = setInterval(fetchRide, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (ride?.status === "searching") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [ride?.status]);

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

  const handleCancel = async () => {
    Alert.alert("Cancelar corrida", "Deseja cancelar esta corrida?", [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar corrida",
        style: "destructive",
        onPress: async () => {
          await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${id}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          clearRide();
          router.replace("/(passenger)");
        },
      },
    ]);
  };

  const openNavigation = (type: "waze" | "gmaps") => {
    if (!ride) return;
    const { destinationLat: lat, destinationLng: lng } = ride;
    const url =
      type === "waze"
        ? `waze://?ll=${lat},${lng}&navigate=yes`
        : `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      if (type === "waze") Linking.openURL(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`);
    });
  };

  const handleRate = () => {
    if (ride?.driverName) {
      router.push(`/rating/${ride.id}`);
    }
  };

  const config = ride ? (STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.searching) : STATUS_CONFIG.searching;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.08)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Detalhes da corrida</Text>
        {ride && (
          <Pressable onPress={() => router.push(`/chat/${ride.id}`)} style={styles.chatBtn}>
            <Feather name="message-circle" size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <GlowView glowColor={config.color} glowIntensity="medium" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          {ride?.status === "searching" && (
            <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
              Aguarde, estamos encontrando um motorista para você...
            </Text>
          )}
        </GlowView>

        {/* Route */}
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

        {/* Driver info */}
        {ride?.driverName && (
          <GlowView style={styles.driverCard} glowIntensity="low">
            <View style={styles.driverRow}>
              <LinearGradient colors={["#00C8FF", "#0044BB"]} style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {ride.driverName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: colors.foreground }]}>{ride.driverName}</Text>
                <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
                  {ride.driverVehicle} · {ride.driverPlate}
                </Text>
              </View>
              <View style={styles.ratingBadge}>
                <Feather name="star" size={12} color="#FFB800" />
                <Text style={[styles.ratingText, { color: colors.foreground }]}>
                  {(ride.driverRating ?? 5).toFixed(1)}
                </Text>
              </View>
            </View>

            {ride.driverPhone && (
              <View style={styles.contactRow}>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${ride.driverPhone}`)}
                  style={[styles.contactBtn, { backgroundColor: colors.muted }]}
                >
                  <Feather name="phone" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/chat/${ride.id}`)}
                  style={[styles.contactBtn, { backgroundColor: colors.muted, flex: 1 }]}
                >
                  <Feather name="message-circle" size={18} color={colors.primary} />
                  <Text style={[styles.contactBtnLabel, { color: colors.primary }]}>Chat</Text>
                </Pressable>
              </View>
            )}
          </GlowView>
        )}

        {/* Navigation buttons */}
        {ride && ["accepted", "arrived", "in_progress"].includes(ride.status) && (
          <View style={styles.navButtons}>
            <PremiumButton
              title="Waze"
              variant="secondary"
              onPress={() => openNavigation("waze")}
              style={{ flex: 1 }}
            />
            <PremiumButton
              title="Google Maps"
              variant="secondary"
              onPress={() => openNavigation("gmaps")}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Actions */}
        {ride?.status === "searching" && (
          <PremiumButton title="Cancelar corrida" variant="danger" onPress={handleCancel} />
        )}

        {ride?.status === "completed" && (
          <PremiumButton title="Avaliar motorista" onPress={handleRate} />
        )}

        {ride?.status === "completed" && (
          <PremiumButton
            title="Voltar ao início"
            variant="ghost"
            onPress={() => router.replace("/(passenger)")}
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
  content: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  statusCard: { padding: 18 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
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
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  contactRow: { flexDirection: "row", gap: 10 },
  contactBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  contactBtnLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  navButtons: { flexDirection: "row", gap: 10 },
});
