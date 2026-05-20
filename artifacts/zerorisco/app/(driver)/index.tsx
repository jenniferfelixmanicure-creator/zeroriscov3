import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { GlowView } from "@/components/GlowView";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface RideRequest {
  id: number;
  categoryName: string;
  originAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  estimatedDistance: number;
  estimatedDuration: number;
}

export default function DriverHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRides, setPendingRides] = useState<RideRequest[]>([]);
  const [accepting, setAccepting] = useState<number | null>(null);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOnline) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      );
      anim.start();
      fetchPendingRides();
      const interval = setInterval(fetchPendingRides, 10000);
      return () => { anim.stop(); clearInterval(interval); };
    } else {
      glowAnim.setValue(0);
      setPendingRides([]);
    }
  }, [isOnline]);

  const fetchPendingRides = async () => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides?status=searching`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRides(data.slice(0, 5));
      }
    } catch {
      // ignore
    }
  };

  const toggleOnline = async (val: boolean) => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/drivers/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: val }),
      });
      if (res.ok) setIsOnline(val);
    } catch {
      Alert.alert("Erro", "Falha ao atualizar status");
    }
  };

  const handleAccept = async (ride: RideRequest) => {
    setAccepting(ride.id);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/${ride.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted", driverId: user?.id }),
      });
      if (res.ok) {
        setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
        Alert.alert("Corrida aceita!", `Indo até ${ride.originAddress}`);
      }
    } catch {
      Alert.alert("Erro", "Falha ao aceitar corrida");
    } finally {
      setAccepting(null);
    }
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["rgba(0,200,255,0.06)", "transparent"]} style={styles.bgGlow} pointerEvents="none" />

      <FlatList
        data={pendingRides}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
            {/* Online toggle */}
            <GlowView
              style={styles.statusCard}
              glowColor={isOnline ? colors.success : colors.mutedForeground}
              glowIntensity={isOnline ? "medium" : "low"}
            >
              <View style={styles.statusRow}>
                <View>
                  <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Status</Text>
                  <Text style={[styles.statusValue, { color: isOnline ? colors.success : colors.mutedForeground }]}>
                    {isOnline ? "Online" : "Offline"}
                  </Text>
                </View>
                {isOnline && (
                  <Animated.View
                    style={[styles.onlinePulse, { backgroundColor: colors.success, opacity: glowOpacity }]}
                  />
                )}
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnline}
                  trackColor={{ false: colors.border, true: colors.success + "55" }}
                  thumbColor={isOnline ? colors.success : colors.mutedForeground}
                />
              </View>
            </GlowView>

            {/* Today's earnings summary */}
            <View style={styles.earningsRow}>
              {[
                { label: "Hoje", value: "R$ 0,00", icon: "dollar-sign" as const },
                { label: "Corridas", value: "0", icon: "navigation" as const },
                { label: "Avaliação", value: "5.0", icon: "star" as const },
              ].map((stat) => (
                <GlowView key={stat.label} style={styles.statCard} glowIntensity="low">
                  <Feather name={stat.icon} size={16} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                </GlowView>
              ))}
            </View>

            {isOnline && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {pendingRides.length > 0 ? "Corridas disponíveis" : "Aguardando corridas..."}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <GlowView glowIntensity="low" style={styles.rideCard}>
              <View style={styles.rideHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.categoryText, { color: colors.primary }]}>{item.categoryName}</Text>
                </View>
                <Text style={[styles.rideFare, { color: colors.primary }]}>
                  R$ {item.estimatedFare.toFixed(2).replace(".", ",")}
                </Text>
              </View>

              <View style={styles.rideRoute}>
                <View style={styles.routeRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{item.originAddress}</Text>
                </View>
                <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                <View style={styles.routeRow}>
                  <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
                  <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{item.destinationAddress}</Text>
                </View>
              </View>

              <View style={styles.rideMeta}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {item.estimatedDistance.toFixed(1)} km · {item.estimatedDuration} min
                </Text>
              </View>

              <View style={styles.rideActions}>
                <PremiumButton
                  title="Recusar"
                  variant="danger"
                  size="sm"
                  onPress={() => setPendingRides((prev) => prev.filter((r) => r.id !== item.id))}
                  style={{ flex: 1 }}
                />
                <PremiumButton
                  title="Aceitar"
                  size="sm"
                  loading={accepting === item.id}
                  onPress={() => handleAccept(item)}
                  style={{ flex: 1 }}
                />
              </View>
            </GlowView>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: "absolute", inset: 0 },
  statusCard: { padding: 20, marginBottom: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statusValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  onlinePulse: { position: "absolute", left: "50%", width: 12, height: 12, borderRadius: 6 },
  earningsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 4 },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  rideCard: { padding: 16 },
  rideHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  rideFare: { fontSize: 18, fontFamily: "Inter_700Bold" },
  rideRoute: { marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  routeLine: { width: 1, height: 14, marginLeft: 3.5, marginVertical: 2 },
  rideMeta: { marginBottom: 14 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rideActions: { flexDirection: "row", gap: 10 },
});
