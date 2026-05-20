import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CategoryCard } from "@/components/CategoryCard";
import { GlowView } from "@/components/GlowView";
import { PremiumButton } from "@/components/PremiumButton";
import { useAuth } from "@/context/AuthContext";
import { useRide } from "@/context/RideContext";
import { useColors } from "@/hooks/useColors";

interface EstimateResult {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedFare: number;
  description?: string;
  minFare?: number;
}

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { setActiveRide } = useRide();
  const params = useLocalSearchParams<{
    originLat: string;
    originLng: string;
    originAddress: string;
    destinationLat: string;
    destinationLng: string;
    destinationAddress: string;
  }>();

  const [estimates, setEstimates] = useState<EstimateResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchEstimates();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides/estimate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: parseFloat(params.originLat ?? "0"),
          originLng: parseFloat(params.originLng ?? "0"),
          destinationLat: parseFloat(params.destinationLat ?? "0"),
          destinationLng: parseFloat(params.destinationLng ?? "0"),
        }),
      });
      if (res.ok) {
        const data: EstimateResult[] = await res.json();
        setEstimates(data);
        if (data.length > 0) setSelected(data[0].categoryId);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível calcular a estimativa");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!selected) return;
    const est = estimates.find((e) => e.categoryId === selected);
    if (!est) return;

    setRequesting(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/rides`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selected,
          originAddress: params.originAddress,
          originLat: parseFloat(params.originLat ?? "0"),
          originLng: parseFloat(params.originLng ?? "0"),
          destinationAddress: params.destinationAddress,
          destinationLat: parseFloat(params.destinationLat ?? "0"),
          destinationLng: parseFloat(params.destinationLng ?? "0"),
          estimatedDistance: est.estimatedDistance,
          estimatedDuration: est.estimatedDuration,
          estimatedFare: est.estimatedFare,
        }),
      });

      if (res.ok) {
        const ride = await res.json();
        setActiveRide({
          id: ride.id,
          status: "searching",
          categoryName: est.categoryName,
          categoryIcon: est.categoryIcon,
          originAddress: params.originAddress ?? "",
          destinationAddress: params.destinationAddress ?? "",
          estimatedFare: est.estimatedFare,
          createdAt: new Date().toISOString(),
        });
        router.replace(`/ride/${ride.id}`);
      } else {
        const err = await res.json();
        Alert.alert("Erro", err.error ?? "Falha ao solicitar corrida");
      }
    } catch {
      Alert.alert("Erro", "Falha na conexão. Tente novamente.");
    } finally {
      setRequesting(false);
    }
  };

  const selectedEst = estimates.find((e) => e.categoryId === selected);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Escolha a categoria</Text>
      </View>

      {/* Route summary */}
      <GlowView style={[styles.routeCard, { marginHorizontal: 20 }]} glowIntensity="low">
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
            {params.originAddress}
          </Text>
        </View>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
            {params.destinationAddress}
          </Text>
        </View>
      </GlowView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Calculando melhores opções...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {estimates.map((est) => (
            <CategoryCard
              key={est.categoryId}
              category={{
                id: est.categoryId,
                name: est.categoryName,
                description: est.description ?? "",
                icon: est.categoryIcon,
                minFare: est.estimatedFare,
                estimatedFare: est.estimatedFare,
                estimatedDistance: est.estimatedDistance,
                estimatedDuration: est.estimatedDuration,
              }}
              selected={selected === est.categoryId}
              onPress={() => setSelected(est.categoryId)}
            />
          ))}
        </ScrollView>
      )}

      {/* Bottom CTA */}
      {!loading && selectedEst && (
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.card, borderColor: colors.cardBorder, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.fareInfo}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Valor estimado</Text>
            <Text style={[styles.fareValue, { color: colors.primary }]}>
              R$ {selectedEst.estimatedFare.toFixed(2).replace(".", ",")}
            </Text>
          </View>
          <PremiumButton
            title="Solicitar corrida"
            onPress={handleRequest}
            loading={requesting}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  routeCard: { padding: 14, marginBottom: 16 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  routeLine: { width: 1, height: 14, marginLeft: 3.5, marginVertical: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  fareInfo: { alignItems: "flex-start" },
  fareLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  fareValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
});
